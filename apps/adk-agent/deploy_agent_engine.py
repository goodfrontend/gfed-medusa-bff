#!/usr/bin/env python3
import os
import sys
from vertexai import Client

TELEMETRY_ENV_VARS = {
    "GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY": "true",
    "OTEL_SEMCONV_STABILITY_OPT_IN": "gen_ai_latest_experimental",
    "OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT": "SPAN_AND_EVENT",
}


def parse_config():
    project = None
    location = None
    display_name = None
    image = None
    service_account = None
    envs = {}
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--env":
            i += 1
            if i >= len(sys.argv):
                print("ERROR: --env requires KEY=VALUE", file=sys.stderr)
                sys.exit(1)
            kv = sys.argv[i]
            if "=" not in kv:
                print(f"ERROR: --env '{kv}' must be KEY=VALUE", file=sys.stderr)
                sys.exit(1)
            key, value = kv.split("=", 1)
            envs[key] = value
        elif sys.argv[i] == "--project":
            i += 1
            if i >= len(sys.argv):
                print("ERROR: --project requires a value", file=sys.stderr)
                sys.exit(1)
            project = sys.argv[i]
        elif sys.argv[i] == "--location":
            i += 1
            if i >= len(sys.argv):
                print("ERROR: --location requires a value", file=sys.stderr)
                sys.exit(1)
            location = sys.argv[i]
        elif sys.argv[i] == "--display-name":
            i += 1
            if i >= len(sys.argv):
                print("ERROR: --display-name requires a value", file=sys.stderr)
                sys.exit(1)
            display_name = sys.argv[i]
        elif sys.argv[i] == "--image":
            i += 1
            if i >= len(sys.argv):
                print("ERROR: --image requires a value", file=sys.stderr)
                sys.exit(1)
            image = sys.argv[i]
        elif sys.argv[i] == "--service-account":
            i += 1
            if i >= len(sys.argv):
                print("ERROR: --service-account requires an email", file=sys.stderr)
                sys.exit(1)
            service_account = sys.argv[i]
        i += 1

    if not project:
        project = os.environ.get("ADK_PROJECT")
    if not location:
        location = os.environ.get("ADK_LOCATION")
    if not display_name:
        display_name = os.environ.get("ADK_DISPLAY_NAME")
    if not image:
        image = os.environ.get("ADK_IMAGE")
    if not service_account:
        service_account = os.environ.get("ADK_SERVICE_ACCOUNT")

    missing = []
    if not project:
        missing.append("PROJECT")
    if not location:
        missing.append("LOCATION")
    if not display_name:
        missing.append("DISPLAY_NAME")
    if missing:
        print(
            "ERROR: missing required configuration: "
            + ", ".join(f"ADK_{m}" for m in missing),
            file=sys.stderr,
        )
        print(
            "Set via env vars or CLI args: --project, --location, --display-name",
            file=sys.stderr,
        )
        sys.exit(1)

    if not image:
        image = f"{location}-docker.pkg.dev/{project}/adk-agent/agent-engine-adk-agent:latest"
    if not service_account:
        service_account = f"personalization-agent-sa@{project}.iam.gserviceaccount.com"
    return project, location, display_name, image, service_account, envs


def build_deploy_config(display_name, image, env_vars, service_account):
    merged = dict(TELEMETRY_ENV_VARS)
    if env_vars:
        merged.update(env_vars)
    config = {
        "display_name": display_name,
        "container_spec": {"image_uri": image},
        "agent_framework": "google-adk",
        "service_account": service_account,
        "min_instances": 1,
        "max_instances": 10,
        "resource_limits": {"cpu": "1", "memory": "2Gi"},
        "container_concurrency": 9,
        "env_vars": merged,
    }
    return config


def find_existing(client, display_name):
    try:
        response = client.agent_engines._list(
            config={"filter": f'display_name="{display_name}"'}
        )
        for engine in response.reasoning_engines:
            if engine.display_name == display_name:
                return engine
    except Exception as e:
        print(f"Warning: could not list existing engines: {e}", file=sys.stderr)
    return None


def main():
    project, location, display_name, image, service_account, env_vars = parse_config()
    print(f"Deploying {display_name} from {image}...")
    if env_vars:
        reserved = {"GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION"}
        filtered = {k: v for k, v in env_vars.items() if k not in reserved}
        if filtered != env_vars:
            dropped = set(env_vars) - set(filtered)
            print(f"  (skipped reserved env vars: {dropped})")
        env_vars = filtered or None
        if env_vars:
            print(f"  with env vars: {env_vars}")

    client = Client(project=project, location=location)
    existing = find_existing(client, display_name)

    if existing:
        print(f"Found existing engine: {existing.name}")
        print("Updating with new container image...")
        try:
            engine = client.agent_engines.update(
                name=existing.name,
                config=build_deploy_config(
                    display_name, image, env_vars, service_account
                ),
            )
            print(f"SUCCESS: {engine.api_resource.name}")
            if hasattr(engine.api_resource, "endpoint"):
                print(f"Endpoint: {engine.api_resource.endpoint}")
        except Exception as e:
            print(f"FAILED: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"No existing engine found -- creating new runtime...")
        try:
            engine = client.agent_engines.create(
                config=build_deploy_config(
                    display_name, image, env_vars, service_account
                ),
            )
            print(f"SUCCESS: {engine.api_resource.name}")
            if hasattr(engine.api_resource, "endpoint"):
                print(f"Endpoint: {engine.api_resource.endpoint}")
        except Exception as e:
            print(f"FAILED: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
