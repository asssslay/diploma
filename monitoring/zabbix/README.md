# Zabbix Monitoring Setup

This repository now exposes a protected telemetry endpoint for Zabbix:

- `GET /healthz` for availability checks
- `GET /api/monitoring/telemetry` for rolling application telemetry

The telemetry payload contains:

- `requestLatency.avgMs`: rolling 5-minute average response time for application requests
- `process.memory.rssBytes`: process RSS memory consumption
- `process.cpu.utilizationPercent`: process CPU utilization normalized to available CPU cores

Requests to `/healthz` and `/api/monitoring/telemetry` are excluded from the rolling latency average so the monitoring probes do not distort the under-load metric.

## 1. Start Zabbix locally

Use the local stack in [docker-compose.yml](/D:/Projects/diploma/monitoring/zabbix/docker-compose.yml):

```bash
docker compose -f monitoring/zabbix/docker-compose.yml up -d
```

Then open `http://localhost:8080`.

Default frontend credentials:

- Username: `Admin`
- Password: `zabbix`

Change the password immediately after first login.

## 2. Set the application monitoring token

Set `MONITORING_TOKEN` in the application environment before you point Zabbix at the service.

For the Render deployment, add:

- `MONITORING_TOKEN=<strong-random-token>`

The same token must be sent by Zabbix as a bearer token when polling `/api/monitoring/telemetry`.

## 3. Create the monitored host

In Zabbix:

1. Go to `Data collection -> Hosts -> Create host`.
2. Name the host `diploma-app`.
3. Add it to a host group such as `Applications`.
4. In the `Macros` tab add:
   - `{$APP_BASE_URL}` = your public base URL, for example `https://diploma-app.onrender.com`
   - `{$MONITORING_TOKEN}` = the same value as `MONITORING_TOKEN`

## 4. Create the helper item and four monitored metrics

### Metric 1: HTTP 200 availability

Create an item with:

- Name: `HTTP health status`
- Type: `HTTP agent`
- Key: `app.health.status`
- URL: `{$APP_BASE_URL}/healthz`
- Request type: `GET`
- Retrieve mode: `Status code`
- Type of information: `Numeric (unsigned)`
- Update interval: `30s`

Expected value: `200`

Recommended trigger expression:

```text
last(/diploma-app/app.health.status)<>200
```

### Helper item: Telemetry master item

Create a master item with:

- Name: `Application telemetry payload`
- Type: `HTTP agent`
- Key: `app.telemetry.raw`
- URL: `{$APP_BASE_URL}/api/monitoring/telemetry`
- Request type: `GET`
- Headers: `Authorization: Bearer {$MONITORING_TOKEN}`
- Retrieve mode: `Body`
- Type of information: `Text`
- Update interval: `30s`

This item stores the JSON document that the dependent items below will parse.

### Metric 2: Average response time

Create a dependent item with:

- Name: `Average response time`
- Type: `Dependent item`
- Key: `app.telemetry.response.avg_ms`
- Master item: `Application telemetry payload`
- Type of information: `Numeric (float)`
- Units: `ms`
- Preprocessing: `JSONPath -> $.requestLatency.avgMs`

Recommended trigger expression:

```text
avg(/diploma-app/app.telemetry.response.avg_ms,5m)>500
```

### Metric 3: RAM consumption

Create a dependent item with:

- Name: `RAM consumption`
- Type: `Dependent item`
- Key: `app.telemetry.memory.rss_bytes`
- Master item: `Application telemetry payload`
- Type of information: `Numeric (unsigned)`
- Units: `B`
- Preprocessing: `JSONPath -> $.process.memory.rssBytes`

Recommended trigger expression:

```text
avg(/diploma-app/app.telemetry.memory.rss_bytes,5m)>536870912
```

The example threshold above is 512 MiB.

### Metric 4: CPU utilization

Create a dependent item with:

- Name: `CPU utilization`
- Type: `Dependent item`
- Key: `app.telemetry.cpu.utilization_percent`
- Master item: `Application telemetry payload`
- Type of information: `Numeric (float)`
- Units: `%`
- Preprocessing: `JSONPath -> $.process.cpu.utilizationPercent`

Recommended trigger expression:

```text
avg(/diploma-app/app.telemetry.cpu.utilization_percent,5m)>80
```

## 5. Validate under load

When you run a load test against the application, Zabbix will show:

- `HTTP health status` staying at `200`
- `Average response time` increasing or stabilizing under sustained traffic
- `RAM consumption` tracking the Bun process RSS
- `CPU utilization` tracking normalized process CPU usage

If you want a sanity check, open the telemetry endpoint directly with the bearer token and confirm the JSON fields update while the load test is running.
