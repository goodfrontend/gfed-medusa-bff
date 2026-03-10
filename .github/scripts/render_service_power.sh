#!/usr/bin/env bash

set -euo pipefail

: "${ACTION:?ACTION is required}"
: "${SERVICES_JSON:?SERVICES_JSON is required}"
: "${RENDER_API_KEY:?RENDER_API_KEY is required}"

append_summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf -- "- %s\n" "$1" >> "$GITHUB_STEP_SUMMARY"
  fi
}

if ! jq -e 'type == "array" and length > 0' >/dev/null 2>&1 <<<"$SERVICES_JSON"; then
  echo "::error::SERVICES_JSON must be a non-empty JSON array."
  exit 1
fi

case "$ACTION" in
  suspend)
    service_target_state="suspended"
    key_value_target_state="suspended"
    endpoint="suspend"
    verb_label="Suspend"
    ;;
  resume)
    service_target_state="not_suspended"
    key_value_target_state="available"
    endpoint="resume"
    verb_label="Resume"
    ;;
  *)
    echo "::error::ACTION must be either suspend or resume."
    exit 1
    ;;
esac

tmp_dir="$(mktemp -d /tmp/render-service-power.XXXXXX)"
trap 'rm -rf "$tmp_dir"' EXIT

render_api_get() {
  local path="$1"
  shift

  curl -sS -G -w "\n%{http_code}" "https://api.render.com${path}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H "Accept: application/json" \
    --max-time 60 \
    --retry 3 \
    --retry-delay 5 \
    "$@"
}

render_api_post() {
  local path="$1"

  curl -sS -w "\n%{http_code}" -X POST "https://api.render.com${path}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H "Accept: application/json" \
    --max-time 60 \
    --retry 3 \
    --retry-delay 5
}

response_body() {
  printf '%s\n' "$1" | sed '$d'
}

response_status() {
  printf '%s\n' "$1" | tail -n 1
}

list_all_services() {
  local include_previews="$1"
  local output_file="$2"

  echo '[]' > "$output_file"
  local cursor=""

  while :; do
    local -a query_args=(
      --data-urlencode "limit=100"
      --data-urlencode "includePreviews=${include_previews}"
    )

    if [ -n "$cursor" ]; then
      query_args+=(--data-urlencode "cursor=${cursor}")
    fi

    local page_resp
    if ! page_resp="$(render_api_get "/v1/services" "${query_args[@]}")"; then
      echo "::error::Failed to list Render services."
      return 1
    fi

    local page_body page_status
    page_body="$(response_body "$page_resp")"
    page_status="$(response_status "$page_resp")"

    if [ "$page_status" -ge 300 ]; then
      echo "::error::Listing Render services failed (HTTP ${page_status})."
      echo "$page_body"
      return 1
    fi

    local merged_file
    merged_file="${output_file}.tmp"
    jq -s '.[0] + .[1]' "$output_file" <(printf '%s' "$page_body") > "$merged_file"
    mv "$merged_file" "$output_file"

    local page_count
    page_count="$(jq -r 'length' <<<"$page_body")"
    if [ "$page_count" -eq 0 ]; then
      break
    fi

    cursor="$(jq -r '(last? // {} | .cursor // empty)' <<<"$page_body")"
    if [ -z "$cursor" ]; then
      break
    fi
  done
}

list_all_key_values() {
  local output_file="$1"

  echo '[]' > "$output_file"
  local cursor=""

  while :; do
    local -a query_args=(
      --data-urlencode "limit=100"
    )

    if [ -n "$cursor" ]; then
      query_args+=(--data-urlencode "cursor=${cursor}")
    fi

    local page_resp
    if ! page_resp="$(render_api_get "/v1/key-value" "${query_args[@]}")"; then
      echo "::error::Failed to list Render Key Value instances."
      return 1
    fi

    local page_body page_status
    page_body="$(response_body "$page_resp")"
    page_status="$(response_status "$page_resp")"

    if [ "$page_status" -ge 300 ]; then
      echo "::error::Listing Render Key Value instances failed (HTTP ${page_status})."
      echo "$page_body"
      return 1
    fi

    local merged_file
    merged_file="${output_file}.tmp"
    jq -s '.[0] + .[1]' "$output_file" <(printf '%s' "$page_body") > "$merged_file"
    mv "$merged_file" "$output_file"

    local page_count
    page_count="$(jq -r 'length' <<<"$page_body")"
    if [ "$page_count" -eq 0 ]; then
      break
    fi

    cursor="$(jq -r '(last? // {} | .cursor // empty)' <<<"$page_body")"
    if [ -z "$cursor" ]; then
      break
    fi
  done
}

all_services_file="$tmp_dir/all-services.json"
all_key_values_file="$tmp_dir/all-key-values.json"
base_targets_file="$tmp_dir/base-targets.json"
preview_targets_file="$tmp_dir/preview-targets.json"
key_value_targets_file="$tmp_dir/key-value-targets.json"
targets_file="$tmp_dir/targets.json"

if ! list_all_services "true" "$all_services_file"; then
  append_summary "${verb_label} failed: could not list Render services."
  exit 1
fi

if ! list_all_key_values "$all_key_values_file"; then
  append_summary "${verb_label} failed: could not list Render Key Value instances."
  exit 1
fi

jq --argjson selected "$SERVICES_JSON" --arg service_target_state "$service_target_state" '
  [
    .[] | .service as $svc
    | select(($selected | index($svc.name)) != null)
    | select((($svc.serviceDetails.parentServer.id // "") == "") and (($svc.serviceDetails.parentServer.name // "") == ""))
    | {
        id: $svc.id,
        name: $svc.name,
        current_state: ($svc.suspended // ""),
        kind: "base",
        target_state: $service_target_state
      }
  ] | unique_by(.id)
' "$all_services_file" > "$base_targets_file"

jq --argjson selected "$SERVICES_JSON" --arg key_value_target_state "$key_value_target_state" '
  [
    .[] | .keyValue as $kv
    | select($kv != null)
    | select(($selected | index($kv.name)) != null)
    | {
        id: $kv.id,
        name: $kv.name,
        current_state: ($kv.status // ""),
        kind: "key_value",
        target_state: $key_value_target_state
      }
  ] | unique_by(.id)
' "$all_key_values_file" > "$key_value_targets_file"

base_names_json="$(jq -c 'map(.name)' "$base_targets_file")"
key_value_names_json="$(jq -c 'map(.name)' "$key_value_targets_file")"
found_names_json="$(jq -cn --argjson base "$base_names_json" --argjson key_values "$key_value_names_json" '
  ($base + $key_values) | unique
')"
unknown_services_json="$(jq -cn --argjson selected "$SERVICES_JSON" --argjson found "$found_names_json" '
  [$selected[] | select(($found | index(.)) == null)]
')"

if [ "$(jq -r 'length' <<<"$unknown_services_json")" -gt 0 ]; then
  echo "::error::Render resources not found: $(jq -r 'join(", ")' <<<"$unknown_services_json")"
  append_summary "${verb_label} failed: unknown Render resources $(jq -r 'join(", ")' <<<"$unknown_services_json")."
  exit 1
fi

base_ids_json="$(jq -c 'map(.id)' "$base_targets_file")"

jq --argjson base_ids "$base_ids_json" --arg service_target_state "$service_target_state" '
  [
    .[] | .service as $svc
    | ($svc.serviceDetails.parentServer.id // "") as $parent_id
    | select($parent_id != "" and (($base_ids | index($parent_id)) != null))
    | {
        id: $svc.id,
        name: $svc.name,
        current_state: ($svc.suspended // ""),
        kind: "preview",
        parent_id: $parent_id,
        parent_name: ($svc.serviceDetails.parentServer.name // ""),
        target_state: $service_target_state
      }
  ] | unique_by(.id)
' "$all_services_file" > "$preview_targets_file"

jq -s 'add | unique_by(.id)' "$base_targets_file" "$preview_targets_file" "$key_value_targets_file" > "$targets_file"

target_count="$(jq -r 'length' "$targets_file")"
preview_count="$(jq -r 'length' "$preview_targets_file")"
key_value_count="$(jq -r 'length' "$key_value_targets_file")"

if [ "$target_count" -eq 0 ]; then
  echo "::error::No Render resources matched the requested target scope."
  append_summary "${verb_label} failed: no Render resources matched the requested target scope."
  exit 1
fi

if [ "$preview_count" -eq 0 ]; then
  echo "::notice::No active preview services were found; continuing without preview targets."
  append_summary "${verb_label} note: no active preview services were found."
fi

if [ "$key_value_count" -gt 0 ]; then
  echo "::notice::Resolved ${target_count} Render target(s), including Key Value instances and active preview children when present."
  append_summary "${verb_label} target scope: selected services, selected Key Value instances, plus active preview children (${target_count} Render target(s))."
else
  echo "::notice::Resolved ${target_count} Render target(s), including active preview children when present."
  append_summary "${verb_label} target scope: selected services plus active preview children (${target_count} Render target(s))."
fi

failures=0

while IFS= read -r target_b64; do
  target_json="$(printf '%s' "$target_b64" | base64 --decode)"
  service_id="$(jq -r '.id' <<<"$target_json")"
  service_name="$(jq -r '.name' <<<"$target_json")"
  current_state="$(jq -r '.current_state // empty' <<<"$target_json")"
  target_kind="$(jq -r '.kind' <<<"$target_json")"
  desired_state="$(jq -r '.target_state' <<<"$target_json")"
  parent_name="$(jq -r '.parent_name // empty' <<<"$target_json")"

  case "$target_kind" in
    preview)
      target_label="Render preview service '${service_name}' under '${parent_name}'"
      action_path="/v1/services/${service_id}/${endpoint}"
      detail_path="/v1/services/${service_id}"
      state_field="suspended"
      ;;
    key_value)
      target_label="Render Key Value instance '${service_name}'"
      action_path="/v1/key-value/${service_id}/${endpoint}"
      detail_path="/v1/key-value/${service_id}"
      state_field="status"
      ;;
    *)
      target_label="Render service '${service_name}'"
      action_path="/v1/services/${service_id}/${endpoint}"
      detail_path="/v1/services/${service_id}"
      state_field="suspended"
      ;;
  esac

  echo "::notice::${verb_label} request for ${target_label}."

  if [ "$current_state" = "$desired_state" ]; then
    echo "::notice::${target_label} is already in the desired state (${current_state})."
    append_summary "${verb_label} skipped for ${service_name}: already ${current_state}."
    continue
  fi

  if ! action_resp="$(render_api_post "$action_path")"; then
    echo "::error::Failed to call ${endpoint} for ${target_label}."
    append_summary "${verb_label} failed for ${service_name}: ${endpoint} request failed."
    failures=$((failures + 1))
    continue
  fi

  action_body="$(response_body "$action_resp")"
  action_status="$(response_status "$action_resp")"

  if [ "$action_status" -eq 404 ] && [ "$target_kind" = "preview" ]; then
    echo "::notice::${target_label} no longer exists; skipping."
    append_summary "${verb_label} skipped for ${service_name}: preview no longer exists."
    continue
  fi

  if [ "$action_status" -ge 300 ]; then
    echo "::error::Render ${endpoint} failed for ${target_label} (HTTP ${action_status})."
    echo "$action_body"
    append_summary "${verb_label} failed for ${service_name}: HTTP ${action_status}."
    failures=$((failures + 1))
    continue
  fi

  attempt=1
  max_attempts=20
  sleep_seconds=15
  reached_target="false"

  while [ "$attempt" -le "$max_attempts" ]; do
    if ! detail_resp="$(render_api_get "$detail_path")"; then
      echo "::warning::Polling failed for ${target_label} on attempt ${attempt}/${max_attempts}."
    else
      detail_body="$(response_body "$detail_resp")"
      detail_status="$(response_status "$detail_resp")"

      if [ "$detail_status" -eq 404 ] && [ "$target_kind" = "preview" ]; then
        echo "::notice::${target_label} was deleted during polling; treating as skipped."
        append_summary "${verb_label} skipped for ${service_name}: preview was deleted during polling."
        reached_target="deleted"
        break
      fi

      if [ "$detail_status" -ge 300 ]; then
        echo "::warning::Polling ${target_label} failed (HTTP ${detail_status}) on attempt ${attempt}/${max_attempts}."
      else
        polled_state="$(echo "$detail_body" | jq -r --arg field "$state_field" '.[$field] // empty')"
        echo "Poll ${attempt}/${max_attempts} for '${service_name}': ${state_field}=${polled_state}"
        if [ "$polled_state" = "$desired_state" ]; then
          reached_target="true"
          break
        fi
      fi
    fi

    attempt=$((attempt + 1))
    sleep "$sleep_seconds"
  done

  if [ "$reached_target" = "deleted" ]; then
    continue
  fi

  if [ "$reached_target" != "true" ]; then
    echo "::error::Timed out waiting for ${target_label} to reach state '${desired_state}'."
    append_summary "${verb_label} failed for ${service_name}: timed out waiting for ${desired_state}."
    failures=$((failures + 1))
    continue
  fi

  echo "::notice::${target_label} is now '${desired_state}'."
  append_summary "${verb_label} succeeded for ${service_name}: now ${desired_state}."
done < <(jq -r '.[] | @base64' "$targets_file")

if [ "$failures" -gt 0 ]; then
  echo "::error::${failures} Render service operation(s) failed."
  exit 1
fi
