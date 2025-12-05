import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { AuthentikClient } from "./authentik.ts";
import { DiscordBotClient } from "./discord.ts";
import { syncAllUsers, syncUserByDiscordId } from "./shared.ts";

const bot = new DiscordBotClient(process.env.DISCORD_BOT_TOKEN || "", process.env.DISCORD_GUILD_ID || "");
const authentik = new AuthentikClient({
    url: process.env.AUTHENTIK_URL || "",
    apiKey: process.env.AUTHENTIK_API_KEY || "",
    authentikUserPath: process.env.AUTHENTIK_USER_PATH || undefined
});

async function main() {
    console.log("Starting authentik-discord-sync...");

    bot.createInteractionCommand({
        data: new SlashCommandBuilder()
            .setName("sync-all")
            .setDescription("Manually trigger a sync between Authentik and Discord.")
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles),
        async execute(interaction) {
            await interaction.reply({ content: "Starting a manual sync...", flags: [MessageFlags.Ephemeral] });
            await syncAllUsers(authentik, bot).then(() => {
                interaction.editReply({ content: "Manual sync complete!" })
            }).catch(async (error) => {
                console.error("Error during manual sync:", error);
                await interaction.editReply({ content: `Manual sync failed: ${error.message}` });
            });
            //await interaction.editReply({ content: "Manual sync complete!" });
        }
    });

    bot.createInteractionCommand({
        data: new SlashCommandBuilder()
            .setName("sync")
            .setDescription(`Sync your authentik account with your Discord roles.`)
            .setContexts(InteractionContextType.Guild),
        async execute(interaction) {
            await interaction.reply({ content: "Starting your account sync...", flags: [MessageFlags.Ephemeral] });
            await syncUserByDiscordId(authentik, bot, interaction.user.id).then(() => {
                interaction.editReply({ content: "Your account sync is complete!" });
            }).catch(async (error) => {
                console.error("Error during personal sync:", error)
                await interaction.editReply({ content: `Your account sync failed: ${error.message}` })
            });
        }
    });

    await bot.login();

    await syncAllUsers(authentik, bot);
    setInterval(async () => {
        console.log("Running scheduled sync...");
        await syncAllUsers(authentik, bot);
    }, 60 * 60 * 1000); // every hour 
}

main()