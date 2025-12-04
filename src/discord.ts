import { ActivityOptions, CacheType, ChatInputCommandInteraction, Client, ClientUser, Collection, MessageContextMenuCommandInteraction, PresenceStatusData, REST, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPostAPIContextMenuApplicationCommandsJSONBody, Routes, SlashCommandBuilder, StatusDisplayType, UserContextMenuCommandInteraction } from "discord.js";

type InteractionTypes = ChatInputCommandInteraction<CacheType> | MessageContextMenuCommandInteraction<CacheType> | UserContextMenuCommandInteraction<CacheType>
export class DiscordBotClient {
    public client: Client;
    public guildId: string;
    private interactions: Map<string, {
        data: SlashCommandBuilder;
        execute: (interaction: InteractionTypes) => Promise<void>;
    }> = new Map();
    private REST: REST;

    constructor(token: string, guildId: string) {
        if (!token) {
            throw new Error("Discord Bot Token is required");
        }
        if (!guildId) {
            throw new Error("Discord Guild ID is required");
        }
        this.guildId = guildId;
        this.client = new Client({ intents: [`GuildMembers`, `Guilds`] });
        this.client.once('clientReady', () => {
            console.log(`Discord Bot logged in as ${this.client.user?.tag}`);
            this.client.guilds.fetch(this.guildId).then(g => { // Pre-fetch the guild
                console.log(`Using guild ${g.name} (${g.id})`);
            }); 
        });
        this.REST = new REST({ version: '10' }).setToken(token);
    }

    public async login() {
        await this.registerEventHandlers();
        await this.client.login(process.env.DISCORD_BOT_TOKEN);
        await this.registerInteractions();
    }

    public async getAllGuildMemebers() {
        return await this.client.guilds.cache.get(this.guildId)?.members.fetch();
    }

    public async getMemberById(discordId: string) {
        return await this.client.guilds.cache.get(this.guildId)?.members.fetch(discordId);
    }

    public async getUserById(discordId: string) {
        return await this.client.users.fetch(discordId);
    }

    public async getRoleById(roleId: string) {
        return await this.client.guilds.cache.get(this.guildId)?.roles.fetch(roleId);
    }

    public async updateStatus(status: PresenceStatusData, options: ActivityOptions) {
        this.client.user?.setStatus(status);
        this.client.user?.setActivity(options);
    }

    private async registerInteractions() {
        let globalCommands = Array<RESTPostAPIChatInputApplicationCommandsJSONBody | RESTPostAPIContextMenuApplicationCommandsJSONBody>();
        for (let [name, interaction] of this.interactions) {
            globalCommands.push(interaction.data.toJSON());
        }
        let commands = await this.client.application?.commands.fetch();
        if (!commands) {
            throw new Error("Failed to fetch existing commands from Discord.");
        }
        for (let command of globalCommands) {
            let existing = commands.find(c => c.name === command.name);
            if (!existing) {
                await this.client.application?.commands.create(command);
                console.log(`Registered command ${command.name}`);
            } else {
                await this.client.application?.commands.edit(existing.id, command);
                console.log(`Updated command ${command.name}`);
            }
        }
    }

    public createInteractionCommand(command: {
        data: SlashCommandBuilder;
        execute: (interaction: InteractionTypes) => Promise<void>;
    }) {
        this.interactions.set(command.data.name, command);
    }

    private registerEventHandlers() {
        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;
            if (!this.interactions.has(interaction.commandName)) return;
            const command = this.interactions.get(interaction.commandName)!;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        });
    }
}