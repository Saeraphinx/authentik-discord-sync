# authentik-discord-sync

A simple bot to handle the syncing of discord roles to authentik groups. Also allows for manual syncing of users via slash commands.

## Setup

### Using Docker Compose

Create a `docker-compose.yml` file with the following content:

```yaml
version: "3.8"

services:
  discord-sync:
    image: ghcr.io/saeraphinx/authentik-discord-sync:latest
    container_name: authentik-discord-sync
    restart: unless-stopped
    environment:
      - DISCORD_BOT_TOKEN: your-discord-bot-token
      - DISCORD_GUILD_ID: your-discord-guild-id
      - AUTHENTIK_URL: authentik.company/api/v3
      - AUTHENTIK_API_KEY: your-authentik-api-key
      - AUTHENTIK_USER_PATH: goauthentik.io/sources/discord-oa
```

## Environment Variables

### Example `.env` file

```sh
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_GUILD_ID=your-discord-guild-id
AUTHENTIK_URL=authentik.company/api/v3
AUTHENTIK_API_KEY=your-authentik-api-key
AUTHENTIK_USER_PATH=goauthentik.io/sources/discord-oa
```

### Configuration Options

| Variable Name (**Required**) | Description                                                           | Default                             |
| ---------------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| **`DISCORD_BOT_TOKEN`**      | Token of your Discord Bot                                             |                                     |
| **`DISCORD_GUILD_ID`**       | ID of the Discord Server that you want to sync roles with             |                                     |
| **`AUTHENTIK_URL`**          | URL of your Authentik instance. e.g. (authentik.company/api/v3)       |                                     |
| **`AUTHENTIK_API_KEY`**      | API key of a service account with the ability to edits users & groups |                                     |
| AUTHENTIK_USER_PATH          | Path of users that you want to automatically sync are located under   | `goauthentik.io/sources/discord-oa` |
