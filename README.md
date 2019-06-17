# Wikia-Bot
<a href="https://discordbots.org/bot/523162656346079234"><img align="right" src="https://discordbots.org/api/widget/523162656346079234.svg" alt="Wikia-Bot"></a>
**Wikia-Bot** is a bot for [Discord](https://discordapp.com/) with the purpose to easily link to [Fandom wikis](https://fandom.wikia.com/explore).
<br>He resolves redirects and follows interwiki links.
<br>**Wikia-Bot** has translations for English, German, French, Dutch, Polish, Portuguese and Turkish.

**Wikia-Bot is not affiliated with Fandom/Wikia and is an unofficial tool!**

[Use this link to invite **Wikia-Bot** to your Discord server.](https://discordapp.com/oauth2/authorize?client_id=523162656346079234&permissions=268954689&scope=bot)

Support server: [https://discord.gg/v77RTk5](https://discord.gg/v77RTk5)

## Commands
For a full list with all commands use `!wikia help`

| Command | Description |
| --- | --- |
| `!wikia <search term>` | **Wikia-Bot** will answer with a link to a matching article in the wiki. |
| `!wikia !<wiki> <search term>` | **Wikia-Bot** will answer with a link to a matching article in the named Fandom wiki: `https://<wiki>.fandom.com/` |
| `!wikia User:<username>` | **Wikia-Bot** will show some information about the user. |
| `!wikia diff <diff> [<oldid>]` | **Wikia-Bot** will answer with a link to the diff in the wiki. |
| `!wikia diff <page name>` | **Wikia-Bot** will answer with a link to the last diff on the article in the wiki. |
| `!wikia random` | **Wikia-Bot** will answer with a link to a random page in the wiki. |
| `!wikia overview` | **Wikia-Bot** will show some information and statistics about the wiki. |
| `!wikia page <page name>` | **Wikia-Bot** will answer with a link to the article in the wiki. |
| `!wikia search <search term>` | **Wikia-Bot** will answer with a link to the search page for the article in the wiki. |
| `!wikia info` | **Wikia-Bot** will introduce himself. |
| `!wikia help` | **Wikia-Bot** will list all the commands that he understands. |
| `!wikia help <bot command>` | **Wikia-Bot** will explain the command. |
| `!wikia test` | If **Wikia-Bot** is active, he will answer! Otherwise not. |

### Admin
For a full list with all administrator commands use `!wikia help admin`

| Command | Description |
| --- | --- |
| `!wikia help admin` | **Wikia-Bot** will list all administrator commands. |
| `!wikia settings` | **Wikia-Bot** will change the settings for the server. |
| `!wikia settings lang <language>` | **Wikia-Bot** will change the language for the server. |
| `!wikia settings wiki <wiki>` | **Wikia-Bot** will change the default wiki for the server. |
| `!wikia settings channel <wiki>` | **Wikia-Bot** will change the default wiki for the current channel. |
| `!wikia pause @Wikia-Bot` | **Wikia-Bot** will ignore all commands on this server, except a few admin commands. |
| `!wikia poll <question as free text>` | **Wikia-Bot** will create a poll and react with `:support:` and `:oppose:`. |
| `!wikia poll <emoji> [<emoji> ...] <question as free text>` | **Wikia-Bot** will create a poll and react with the possible answers. |
| `!wikia say <message>` | **Wikia-Bot** will write the given message. |
| `!wikia say alarm <message>` | **Wikia-Bot** will write the given message already preformatted: **`🚨 <message> 🚨`** |
| `!wikia delete <count>` | **Wikia-Bot** will delete the recent messages in the channel, as long as they aren't older than 14 days. |

## Voice channel
**Wikia-Bot** is able to give everyone in a voice channel a specific role. Use `!wikia voice` to get the format for the role name.
