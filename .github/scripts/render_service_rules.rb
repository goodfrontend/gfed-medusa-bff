#!/usr/bin/env ruby

require "json"
require "time"
require "yaml"

DATETIME_FORMATS = [
  "%Y-%m-%dT%H:%M",
  "%Y-%m-%d %H:%M",
  "%Y-%m-%dT%H:%M:%S",
  "%Y-%m-%d %H:%M:%S",
].freeze

STORE_VERSION = 1
ACTIONS = %w[suspend resume].freeze
SCHEDULE_TYPES = %w[immediate scheduled recurring window_scheduled window_recurring].freeze
WINDOW_SCHEDULE_TYPES = %w[window_scheduled window_recurring].freeze

def abort_with(message)
  warn(message)
  exit(1)
end

def load_store(path)
  return { "version" => STORE_VERSION, "rules" => [] } unless File.file?(path) && !File.zero?(path)

  data = JSON.parse(File.read(path))
  unless data.is_a?(Hash) && data["rules"].is_a?(Array)
    abort_with("Invalid rules store at #{path}: expected an object with a rules array.")
  end

  data["version"] ||= STORE_VERSION
  data
rescue JSON::ParserError => e
  abort_with("Invalid JSON in #{path}: #{e.message}")
end

def save_json(path, data)
  File.write(path, JSON.pretty_generate(data) + "\n")
end

def load_available_services(render_file)
  yaml = YAML.safe_load(File.read(render_file), permitted_classes: [], aliases: false)
  unless yaml.is_a?(Hash)
    abort_with("Invalid #{render_file}: expected a top-level mapping.")
  end

  services = Array(yaml["projects"]).flat_map do |project|
    Array(project["environments"]).flat_map do |environment|
      Array(environment["services"]).map do |service|
        service["name"].to_s.strip
      end
    end
  end

  services = services.reject(&:empty?).uniq
  abort_with("No services were found in #{render_file}.") if services.empty?

  services
rescue Psych::Exception => e
  abort_with("Unable to parse #{render_file}: #{e.message}")
end

def resolve_services(input, available_services)
  raw = input.to_s.strip
  return available_services.dup if raw.empty? || raw.casecmp("all").zero?

  selected = raw.split(/[\n,]+/).map(&:strip).reject(&:empty?).uniq
  abort_with("services must be a comma-separated list or 'all'.") if selected.empty?

  unknown = selected - available_services
  unless unknown.empty?
    abort_with(
      "Unknown services: #{unknown.join(', ')}. Available services: #{available_services.join(', ')}."
    )
  end

  selected
end

def normalize_rule_id(rule_name)
  rule_id = rule_name.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-+|-+\z/, "")
  abort_with("rule_name must contain at least one letter or number.") if rule_id.empty?

  rule_id
end

def validate_timezone!(timezone)
  tz = timezone.to_s.strip
  abort_with("timezone is required.") if tz.empty?

  zoneinfo_path = File.join("/usr/share/zoneinfo", tz)
  return tz if tz == "UTC" || File.file?(zoneinfo_path)

  abort_with("Invalid timezone '#{timezone}'. Use an IANA timezone such as UTC or Asia/Manila.")
end

def with_timezone(timezone)
  previous_timezone = ENV["TZ"]
  ENV["TZ"] = timezone
  yield
ensure
  ENV["TZ"] = previous_timezone
end

def parse_local_datetime(raw, timezone, input_name:)
  input = raw.to_s.strip
  abort_with("#{input_name} is required.") if input.empty?

  with_timezone(timezone) do
    DATETIME_FORMATS.each do |format|
      begin
        return Time.strptime(input, format)
      rescue ArgumentError
        next
      end
    end
  end

  abort_with(
    "Invalid #{input_name} '#{raw}'. Use YYYY-MM-DDTHH:MM[:SS] or YYYY-MM-DD HH:MM[:SS]."
  )
end

def parse_integer(value, min, max, label)
  integer = Integer(value, exception: false)
  abort_with("Invalid #{label} value '#{value}'.") if integer.nil?
  abort_with("#{label} must be between #{min} and #{max}.") unless integer.between?(min, max)

  integer
end

def parse_dow_value(value, label)
  integer = Integer(value, exception: false)
  abort_with("Invalid #{label} value '#{value}'.") if integer.nil?

  return 0 if integer == 7
  abort_with("#{label} must be between 0 and 7.") unless integer.between?(0, 7)

  integer
end

def expand_cron_field(field, min, max, label, allow_sunday_seven: false)
  full_range = (min..max)

  values = field.split(",").flat_map do |part|
    part = part.strip
    abort_with("#{label} field is empty in cron expression.") if part.empty?

    base, step_raw, extra = part.split("/", 3)
    abort_with("Invalid #{label} cron segment '#{part}'.") if extra

    step =
      if step_raw.nil?
        nil
      else
        step_value = Integer(step_raw, exception: false)
        abort_with("Invalid step '#{step_raw}' in #{label} cron segment '#{part}'.") if step_value.nil? || step_value <= 0
        step_value
      end

    if base == "*" || base.empty?
      full_range.step(step || 1).to_a
    elsif base.include?("-")
      range_start_raw, range_end_raw = base.split("-", 2)
      abort_with("Invalid #{label} cron range '#{base}'.") if range_start_raw.nil? || range_end_raw.nil?
      if allow_sunday_seven && (range_start_raw == "7" || range_end_raw == "7")
        abort_with("Use 0 for Sunday in #{label} ranges; exact value 7 is supported only as a single entry.")
      end

      range_start = allow_sunday_seven ? parse_dow_value(range_start_raw, label) : parse_integer(range_start_raw, min, max, label)
      range_end = allow_sunday_seven ? parse_dow_value(range_end_raw, label) : parse_integer(range_end_raw, min, max, label)
      abort_with("#{label} range start must be less than or equal to range end.") if range_start > range_end

      (range_start..range_end).step(step || 1).to_a
    else
      abort_with("Step syntax is only supported with '*' or ranges in the #{label} field.") if step
      [allow_sunday_seven ? parse_dow_value(base, label) : parse_integer(base, min, max, label)]
    end
  end

  values.uniq.sort
end

def build_cron_spec(cron_expression, input_name:)
  raw = cron_expression.to_s.strip
  abort_with("#{input_name} is required.") if raw.empty?

  fields = raw.split(/\s+/)
  abort_with("#{input_name} must contain exactly 5 fields.") unless fields.length == 5

  minute_values = expand_cron_field(fields[0], 0, 59, "minute")
  if minute_values.any? { |value| (value % 5).nonzero? }
    abort_with(
      "#{input_name} minute field must resolve to 5-minute boundaries because the reconciler runs every 5 minutes."
    )
  end

  hour_values = expand_cron_field(fields[1], 0, 23, "hour")
  dom_values = expand_cron_field(fields[2], 1, 31, "day-of-month")
  month_values = expand_cron_field(fields[3], 1, 12, "month")
  dow_values = expand_cron_field(fields[4], 0, 6, "day-of-week", allow_sunday_seven: true)

  {
    "raw" => raw,
    "minute_values" => minute_values,
    "hour_values" => hour_values,
    "dom_values" => dom_values,
    "month_values" => month_values,
    "dow_values" => dow_values,
    "dom_any" => dom_values == (1..31).to_a,
    "dow_any" => dow_values == (0..6).to_a,
  }
end

def cron_matches?(cron_expression, timezone, now_utc)
  spec = build_cron_spec(cron_expression, input_name: "cron")
  local_time = with_timezone(timezone) { now_utc.getlocal }

  minute_match = spec["minute_values"].include?(local_time.min)
  hour_match = spec["hour_values"].include?(local_time.hour)
  month_match = spec["month_values"].include?(local_time.month)
  dom_match = spec["dom_values"].include?(local_time.day)
  dow_match = spec["dow_values"].include?(local_time.wday)

  day_match =
    if spec["dom_any"] && spec["dow_any"]
      true
    elsif spec["dom_any"]
      dow_match
    elsif spec["dow_any"]
      dom_match
    else
      dom_match || dow_match
    end

  minute_match && hour_match && month_match && day_match
end

def recurring_run_key(timezone, now_utc)
  with_timezone(timezone) { now_utc.getlocal.strftime("%Y-%m-%dT%H:%M%z") }
end

def opposite_action(action)
  case action
  when "suspend"
    "resume"
  when "resume"
    "suspend"
  else
    abort_with("Unsupported action '#{action}'.")
  end
end

def parse_enabled(value)
  case value.to_s.strip.downcase
  when "true"
    true
  when "false"
    false
  else
    abort_with("enabled must be true or false.")
  end
end

def reset_schedule_fields!(rule)
  %w[
    action
    end_action
    schedule_type
    run_at_input
    run_at_utc
    run_at_epoch
    cron
    last_run_key
    window_start_input
    window_start_utc
    window_start_epoch
    window_end_input
    window_end_utc
    window_end_epoch
    window_start_cron
    window_end_cron
    last_window_start_run_key
    last_window_end_run_key
    window_start_completed_at_utc
    window_end_completed_at_utc
  ].each do |key|
    rule.delete(key)
  end
end

def due_rule(rule_id:, rule_name:, action:, schedule_type:, timezone:, services:, run_key:, boundary: nil, cron: nil)
  payload = {
    "rule_id" => rule_id,
    "rule_name" => rule_name,
    "action" => action,
    "schedule_type" => schedule_type,
    "timezone" => timezone,
    "services" => services,
    "run_key" => run_key,
  }
  payload["boundary"] = boundary unless boundary.nil?
  payload["cron"] = cron unless cron.nil?
  payload
end

def write_configure_output(path, result)
  save_json(path, result)
end

def command_configure(render_file, store_file, output_file)
  abort_with("Usage: render_service_rules.rb configure RENDER_FILE STORE_FILE OUTPUT_FILE") unless output_file

  action = ENV.fetch("RULE_ACTION", "").strip
  schedule_type = ENV.fetch("SCHEDULE_TYPE", "").strip
  services_input = ENV.fetch("SERVICES_INPUT", "")
  rule_name = ENV.fetch("RULE_NAME", "").strip
  enabled = parse_enabled(ENV.fetch("RULE_ENABLED", "true"))
  scheduled_at = ENV.fetch("SCHEDULED_AT", "")
  scheduled_end_at = ENV.fetch("SCHEDULED_END_AT", "")
  recurring_cron = ENV.fetch("RECURRING_CRON", "")
  window_start_cron = ENV.fetch("WINDOW_START_CRON", "")
  window_end_cron = ENV.fetch("WINDOW_END_CRON", "")
  timezone = validate_timezone!(ENV.fetch("RULE_TIMEZONE", "UTC"))
  actor = ENV.fetch("GITHUB_ACTOR", "")
  workflow = ENV.fetch("GITHUB_WORKFLOW", "")
  run_id = ENV.fetch("GITHUB_RUN_ID", "")

  abort_with("action must be either 'suspend' or 'resume'.") unless ACTIONS.include?(action)
  abort_with("schedule_type must be one of: #{SCHEDULE_TYPES.join(', ')}.") unless SCHEDULE_TYPES.include?(schedule_type)

  now_utc = Time.now.utc
  available_services = load_available_services(render_file)
  store = load_store(store_file)
  store["available_services"] = available_services
  store["updated_at_utc"] = now_utc.iso8601
  store["updated_by"] = actor

  rule_id = nil
  existing_rule = nil

  if schedule_type != "immediate"
    abort_with("rule_name is required when schedule_type is not immediate.") if rule_name.empty?
    rule_id = normalize_rule_id(rule_name)
    existing_rule = store["rules"].find { |rule| rule["id"] == rule_id }
  end

  if !enabled
    abort_with("enabled=false is only valid for saved schedules.") if schedule_type == "immediate"
    abort_with("No existing rule named '#{rule_name}' was found to disable.") if existing_rule.nil?

    existing_rule["enabled"] = false
    existing_rule["updated_at_utc"] = now_utc.iso8601
    existing_rule["updated_by"] = actor
    existing_rule["source_workflow"] = workflow
    existing_rule["source_run_id"] = run_id

    save_json(store_file, store)
    write_configure_output(
      output_file,
      {
        "run_immediately" => false,
        "persist_store" => true,
        "dispatch_watcher" => false,
        "watcher_epochs" => [],
        "action" => existing_rule["action"],
        "schedule_type" => existing_rule["schedule_type"],
        "selected_services" => Array(existing_rule["services"]),
        "selected_services_csv" => Array(existing_rule["services"]).join(","),
        "rule_id" => rule_id,
        "rule_name" => existing_rule["name"],
        "summary" => [
          "Rule disabled: #{existing_rule['name']} (#{rule_id})",
          "Original schedule type: #{existing_rule['schedule_type']}",
          "Services: #{Array(existing_rule['services']).join(', ')}",
        ],
      },
    )
    return
  end

  selected_services = resolve_services(services_input, available_services)

  if schedule_type == "immediate"
    result = {
      "run_immediately" => true,
      "persist_store" => false,
      "dispatch_watcher" => false,
      "watcher_epochs" => [],
      "action" => action,
      "schedule_type" => schedule_type,
      "selected_services" => selected_services,
      "selected_services_csv" => selected_services.join(","),
      "summary" => [
        "Action: #{action}",
        "Schedule type: immediate",
        "Services: #{selected_services.join(', ')}",
        "Preview handling: selected services plus active preview children",
      ],
    }

    write_configure_output(output_file, result)
    return
  end

  rule = existing_rule || {}
  reset_schedule_fields!(rule)
  rule["id"] = rule_id
  rule["name"] = rule_name
  rule["schedule_type"] = schedule_type
  rule["services"] = selected_services
  rule["timezone"] = timezone
  rule["enabled"] = true
  rule["created_at_utc"] ||= now_utc.iso8601
  rule["created_by"] ||= actor
  rule["updated_at_utc"] = now_utc.iso8601
  rule["updated_by"] = actor
  rule["source_workflow"] = workflow
  rule["source_run_id"] = run_id
  rule["completed_at_utc"] = nil
  rule["last_status"] = nil
  rule["last_error"] = nil

  summary = [
    "Rule saved: #{rule_name} (#{rule_id})",
    "Schedule type: #{schedule_type}",
    "Services: #{selected_services.join(', ')}",
    "Preview handling: selected services plus active preview children",
    "Timezone: #{timezone}",
  ]

  watcher_epochs = []

  case schedule_type
  when "scheduled"
    scheduled_time_utc = parse_local_datetime(scheduled_at, timezone, input_name: "scheduled_at").getutc
    abort_with("scheduled_at must be in the future.") if scheduled_time_utc <= now_utc

    rule["action"] = action
    rule["run_at_input"] = scheduled_at.strip
    rule["run_at_utc"] = scheduled_time_utc.iso8601
    rule["run_at_epoch"] = scheduled_time_utc.to_i
    rule["cron"] = nil
    rule["last_run_key"] = nil
    watcher_epochs << scheduled_time_utc.to_i

    summary << "Action: #{action}"
    summary << "Scheduled at (local): #{scheduled_at.strip}"
    summary << "Scheduled at (UTC): #{scheduled_time_utc.iso8601}"
  when "recurring"
    cron_spec = build_cron_spec(recurring_cron, input_name: "recurring_cron")

    rule["action"] = action
    rule["cron"] = cron_spec["raw"]
    rule["run_at_input"] = nil
    rule["run_at_utc"] = nil
    rule["run_at_epoch"] = nil
    rule["last_run_key"] = nil

    summary << "Action: #{action}"
    summary << "Recurring cron: #{cron_spec['raw']}"
    summary << "Cron resolution: 5-minute reconciler"
  when "window_scheduled"
    window_start_utc = parse_local_datetime(scheduled_at, timezone, input_name: "scheduled_at").getutc
    window_end_utc = parse_local_datetime(scheduled_end_at, timezone, input_name: "scheduled_end_at").getutc

    abort_with("scheduled_at must be in the future.") if window_start_utc <= now_utc
    abort_with("scheduled_end_at must be after scheduled_at.") if window_end_utc <= window_start_utc

    rule["action"] = action
    rule["end_action"] = opposite_action(action)
    rule["window_start_input"] = scheduled_at.strip
    rule["window_start_utc"] = window_start_utc.iso8601
    rule["window_start_epoch"] = window_start_utc.to_i
    rule["window_end_input"] = scheduled_end_at.strip
    rule["window_end_utc"] = window_end_utc.iso8601
    rule["window_end_epoch"] = window_end_utc.to_i
    rule["window_start_completed_at_utc"] = nil
    rule["window_end_completed_at_utc"] = nil
    watcher_epochs.concat([window_start_utc.to_i, window_end_utc.to_i])

    summary << "Window start action: #{action}"
    summary << "Window end action: #{rule['end_action']}"
    summary << "Window start (local): #{scheduled_at.strip}"
    summary << "Window start (UTC): #{window_start_utc.iso8601}"
    summary << "Window end (local): #{scheduled_end_at.strip}"
    summary << "Window end (UTC): #{window_end_utc.iso8601}"
  when "window_recurring"
    start_spec = build_cron_spec(window_start_cron, input_name: "window_start_cron")
    end_spec = build_cron_spec(window_end_cron, input_name: "window_end_cron")
    abort_with("window_start_cron and window_end_cron must not be identical.") if start_spec["raw"] == end_spec["raw"]

    rule["action"] = action
    rule["end_action"] = opposite_action(action)
    rule["window_start_cron"] = start_spec["raw"]
    rule["window_end_cron"] = end_spec["raw"]
    rule["last_window_start_run_key"] = nil
    rule["last_window_end_run_key"] = nil

    summary << "Window start action: #{action}"
    summary << "Window end action: #{rule['end_action']}"
    summary << "Window start cron: #{start_spec['raw']}"
    summary << "Window end cron: #{end_spec['raw']}"
    summary << "Cron resolution: 5-minute reconciler"
  end

  store["rules"] << rule if existing_rule.nil?

  save_json(store_file, store)
  write_configure_output(
    output_file,
    {
      "run_immediately" => false,
      "persist_store" => true,
      "dispatch_watcher" => !watcher_epochs.empty?,
      "watcher_epochs" => watcher_epochs,
      "action" => action,
      "schedule_type" => schedule_type,
      "selected_services" => selected_services,
      "selected_services_csv" => selected_services.join(","),
      "rule_id" => rule_id,
      "rule_name" => rule_name,
      "summary" => summary,
    },
  )
end

def command_plan(store_file, output_file)
  abort_with("Usage: render_service_rules.rb plan STORE_FILE OUTPUT_FILE") unless output_file

  now_utc =
    if ENV["NOW_EPOCH"].to_s.strip.empty?
      Time.now.utc
    else
      epoch = Integer(ENV["NOW_EPOCH"], exception: false)
      abort_with("NOW_EPOCH must be a unix epoch.") if epoch.nil?
      Time.at(epoch).utc
    end

  store = load_store(store_file)
  due_rules = []
  summary = []

  Array(store["rules"]).each do |rule|
    next unless rule["enabled"] == true

    rule_id = rule["id"].to_s
    rule_name = rule["name"].to_s
    schedule_type = rule["schedule_type"].to_s
    timezone = validate_timezone!(rule["timezone"].to_s.empty? ? "UTC" : rule["timezone"].to_s)
    services = Array(rule["services"]).map(&:to_s).reject(&:empty?)
    action = rule["action"].to_s

    abort_with("Rule #{rule_id} is missing services.") if services.empty?
    abort_with("Rule #{rule_id} has invalid action '#{action}'.") unless ACTIONS.include?(action)

    case schedule_type
    when "scheduled"
      run_at_epoch = Integer(rule["run_at_epoch"], exception: false)
      abort_with("Scheduled rule #{rule_id} is missing run_at_epoch.") if run_at_epoch.nil?
      next if rule["completed_at_utc"]
      next if now_utc.to_i < run_at_epoch

      due_rules << due_rule(
        rule_id: rule_id,
        rule_name: rule_name,
        action: action,
        schedule_type: schedule_type,
        timezone: timezone,
        services: services,
        run_key: rule["run_at_utc"].to_s.empty? ? run_at_epoch.to_s : rule["run_at_utc"].to_s,
      )
      summary << "Due scheduled rule: #{rule_name} (#{rule_id})"
    when "recurring"
      cron = rule["cron"].to_s.strip
      abort_with("Recurring rule #{rule_id} is missing cron.") if cron.empty?
      next unless cron_matches?(cron, timezone, now_utc)

      run_key = recurring_run_key(timezone, now_utc)
      next if rule["last_run_key"] == run_key

      due_rules << due_rule(
        rule_id: rule_id,
        rule_name: rule_name,
        action: action,
        schedule_type: schedule_type,
        timezone: timezone,
        services: services,
        run_key: run_key,
        cron: cron,
      )
      summary << "Due recurring rule: #{rule_name} (#{rule_id})"
    when "window_scheduled"
      end_action = rule["end_action"].to_s.empty? ? opposite_action(action) : rule["end_action"].to_s
      abort_with("Window scheduled rule #{rule_id} has invalid end_action '#{end_action}'.") unless ACTIONS.include?(end_action)

      window_start_epoch = Integer(rule["window_start_epoch"], exception: false)
      window_end_epoch = Integer(rule["window_end_epoch"], exception: false)
      abort_with("Window scheduled rule #{rule_id} is missing window_start_epoch.") if window_start_epoch.nil?
      abort_with("Window scheduled rule #{rule_id} is missing window_end_epoch.") if window_end_epoch.nil?
      abort_with("Window scheduled rule #{rule_id} has window_end_epoch before window_start_epoch.") if window_end_epoch <= window_start_epoch

      if now_utc.to_i >= window_end_epoch
        next if rule["window_end_completed_at_utc"]

        due_rules << due_rule(
          rule_id: rule_id,
          rule_name: rule_name,
          action: end_action,
          schedule_type: schedule_type,
          timezone: timezone,
          services: services,
          run_key: rule["window_end_utc"].to_s.empty? ? window_end_epoch.to_s : rule["window_end_utc"].to_s,
          boundary: "end",
        )
        summary << "Due scheduled window end: #{rule_name} (#{rule_id})"
      elsif now_utc.to_i >= window_start_epoch
        next if rule["window_start_completed_at_utc"]

        due_rules << due_rule(
          rule_id: rule_id,
          rule_name: rule_name,
          action: action,
          schedule_type: schedule_type,
          timezone: timezone,
          services: services,
          run_key: rule["window_start_utc"].to_s.empty? ? window_start_epoch.to_s : rule["window_start_utc"].to_s,
          boundary: "start",
        )
        summary << "Due scheduled window start: #{rule_name} (#{rule_id})"
      end
    when "window_recurring"
      end_action = rule["end_action"].to_s.empty? ? opposite_action(action) : rule["end_action"].to_s
      abort_with("Window recurring rule #{rule_id} has invalid end_action '#{end_action}'.") unless ACTIONS.include?(end_action)

      start_cron = rule["window_start_cron"].to_s.strip
      end_cron = rule["window_end_cron"].to_s.strip
      abort_with("Window recurring rule #{rule_id} is missing window_start_cron.") if start_cron.empty?
      abort_with("Window recurring rule #{rule_id} is missing window_end_cron.") if end_cron.empty?

      run_key = recurring_run_key(timezone, now_utc)

      if cron_matches?(start_cron, timezone, now_utc) && rule["last_window_start_run_key"] != run_key
        due_rules << due_rule(
          rule_id: rule_id,
          rule_name: rule_name,
          action: action,
          schedule_type: schedule_type,
          timezone: timezone,
          services: services,
          run_key: run_key,
          boundary: "start",
          cron: start_cron,
        )
        summary << "Due recurring window start: #{rule_name} (#{rule_id})"
      end

      if cron_matches?(end_cron, timezone, now_utc) && rule["last_window_end_run_key"] != run_key
        due_rules << due_rule(
          rule_id: rule_id,
          rule_name: rule_name,
          action: end_action,
          schedule_type: schedule_type,
          timezone: timezone,
          services: services,
          run_key: run_key,
          boundary: "end",
          cron: end_cron,
        )
        summary << "Due recurring window end: #{rule_name} (#{rule_id})"
      end
    else
      abort_with("Rule #{rule_id} has unsupported schedule type '#{schedule_type}'.")
    end
  end

  save_json(
    output_file,
    {
      "planned_at_utc" => now_utc.iso8601,
      "due_rules" => due_rules,
      "summary" => summary,
    },
  )
end

def command_record(store_file, rule_id)
  abort_with("Usage: render_service_rules.rb record STORE_FILE RULE_ID") if rule_id.to_s.strip.empty?

  status = ENV.fetch("RULE_STATUS", "").strip
  run_key = ENV.fetch("RULE_RUN_KEY", "").strip
  error_text = ENV.fetch("RULE_ERROR", "").strip
  boundary = ENV.fetch("RULE_BOUNDARY", "").strip
  actor = ENV.fetch("GITHUB_ACTOR", "")
  now_utc = Time.now.utc

  abort_with("RULE_STATUS must be success or failed.") unless %w[success failed].include?(status)

  store = load_store(store_file)
  rule = store["rules"].find { |entry| entry["id"] == rule_id }
  abort_with("Rule '#{rule_id}' was not found in #{store_file}.") if rule.nil?

  rule["last_status"] = status
  rule["last_triggered_at_utc"] = now_utc.iso8601
  rule["updated_at_utc"] = now_utc.iso8601
  rule["updated_by"] = actor
  rule["last_error"] = error_text.empty? ? nil : error_text
  rule["last_boundary"] = boundary.empty? ? nil : boundary

  case rule["schedule_type"]
  when "recurring"
    rule["last_run_key"] = run_key unless run_key.empty?
  when "scheduled"
    if status == "success"
      rule["enabled"] = false
      rule["completed_at_utc"] = now_utc.iso8601
    end
  when "window_recurring"
    case boundary
    when "start"
      rule["last_window_start_run_key"] = run_key unless run_key.empty?
    when "end"
      rule["last_window_end_run_key"] = run_key unless run_key.empty?
    else
      abort_with("RULE_BOUNDARY must be start or end for window_recurring rules.")
    end
  when "window_scheduled"
    case boundary
    when "start"
      rule["window_start_completed_at_utc"] = now_utc.iso8601 if status == "success"
    when "end"
      if status == "success"
        rule["window_end_completed_at_utc"] = now_utc.iso8601
        rule["enabled"] = false
        rule["completed_at_utc"] = now_utc.iso8601
      end
    else
      abort_with("RULE_BOUNDARY must be start or end for window_scheduled rules.")
    end
  end

  save_json(store_file, store)
end

command = ARGV.shift

case command
when "configure"
  command_configure(ARGV[0], ARGV[1], ARGV[2])
when "plan"
  command_plan(ARGV[0], ARGV[1])
when "record"
  command_record(ARGV[0], ARGV[1])
else
  abort_with("Usage: render_service_rules.rb [configure|plan|record] ...")
end
