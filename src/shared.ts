import { ActivityType, GuildMember } from "discord.js";
import { AuthentikClient, AuthentikUser } from "./authentik.ts";
import { DiscordBotClient } from "./discord.ts";
import { Group } from "@goauthentik/api";

export async function syncAllUsers(authentik: AuthentikClient, discord: DiscordBotClient) {
    discord.updateStatus(`online` ,{ name: "Syncing users...", type: ActivityType.Custom });
    console.log("Fetching all synced users & groups from Authentik...");
    const akUsers: AuthentikUser[] = await authentik.getAllSyncedUsers();
    const akGroups = await authentik.getSyncableGroups(true);
    console.log(`Fetched ${akUsers.length} users & ${akGroups.length} groups from Authentik.`);
    console.log("Fetching all guild members from Discord...");
    const guildMembers = await discord.getAllGuildMemebers();
    console.log(`Fetched ${guildMembers?.size} members from Discord.`);
    if (!guildMembers) {
        throw new Error("Failed to fetch guild members from Discord.");
    }


    for (let akUser of akUsers) {
        const discordId = akUser.attributes ? akUser.attributes['discord_id'] as string : null;
        if (!discordId) {
            console.log(`User ${akUser.username} (${akUser.pk}) does not have a linked Discord ID. Skipping.`);
            continue;
        }
        const member: GuildMember | undefined = guildMembers.get(discordId);

        // update user active status based on presence in guild
        if (!member) {
            console.log(`Discord member with ID ${discordId} not found in guild.`);
            if (akUser.isActive) {
                await authentik.updateUserAttributes(akUser, { is_active: false });
                console.log(`Deactivated user ${akUser.username} (${akUser.pk}).`);
                continue;
            }
        } else {
            if (!akUser.isActive) {
                await authentik.updateUserAttributes(akUser, { is_active: true });
                console.log(`Re-activated user ${akUser.username} (${akUser.pk}).`);
            }
        }

        if (member) {
            // sync groups
            await compareGroups(authentik, akUser, member!, akGroups)

            // update user info
            await authentik.updateUserAttributes(akUser, {
                username: member.user.username,
                name: member.user.globalName ?? member.user.username,
                avatar: member.user.displayAvatarURL({ size: 256 })
            });
            console.log(`Updated attributes for user ${akUser.username} (${akUser.pk}).`);
        }
    }
    console.log("User sync complete.");
    discord.updateStatus(`idle`, { name: "Awaiting next sync...", type: ActivityType.Custom });
}

export async function syncUserByDiscordId(authentik: AuthentikClient, discord: DiscordBotClient, discordMember: GuildMember | string) {
    let shouldDeactivate = false;
    console.log(`Syncing user for Discord ID ${typeof discordMember === "string" ? discordMember : discordMember.id}...`);
    if (typeof discordMember === "string") {
        let member = await discord.getMemberById(discordMember);
        if (!member) {
            console.warn(`Discord member with ID ${discordMember} not found in guild.`);
            let user = await discord.getUserById(discordMember);
            if (!user) {
                throw new Error(`Discord user with ID ${discordMember} not found.`);
            }
            discordMember = {
                ...user,
            } as any as GuildMember; // cast to GuildMember for simplicity
            shouldDeactivate = true;
        } else {
            discordMember = member;
        }
    }
    let authentikUser = await authentik.getUserByDiscordId(discordMember.id);
    if (!authentikUser) {
        throw new Error(`No Authentik user found with Discord ID ${discordMember.id}`);
    }

    // update user active status based on presence in guild
    if (shouldDeactivate) {
        if (authentikUser.isActive) {
            console.log(`Deactivating user ${authentikUser.username} (${authentikUser.pk}) as they are no longer in the guild.`);
            await authentik.updateUserAttributes(authentikUser, { is_active: false });
        }
    } else {
        if (!authentikUser.isActive) {
            console.log(`Re-activating user ${authentikUser.username} (${authentikUser.pk}) as they are present in the guild.`);
            await authentik.updateUserAttributes(authentikUser, { is_active: true });
        }
    }

    const akGroups = await authentik.getSyncableGroups(true);
    // sync groups
    await compareGroups(authentik, authentikUser, discordMember, akGroups);

    // update user info
    await authentik.updateUserAttributes(authentikUser, {
        username: discordMember.user.username,
        name: discordMember.user.globalName ?? discordMember.user.username,
        avatar: discordMember.user.displayAvatarURL({ size: 256 })
    });
    console.log(`User sync for Discord ID ${discordMember.id} complete.`);
}

async function compareGroups(authentik: AuthentikClient, authentikUser:AuthentikUser, member: GuildMember, akGroups: Group[]) {
    for (let group of akGroups) {
        const discordRoleId = group.attributes!['discord_role_id'];
        const hasRole = member.roles.cache.has(discordRoleId);
        const inGroup = group.usersObj?.some(user => user.pk === authentikUser.pk) || false;
        if (hasRole && !inGroup) {
            // Add user to group
            await authentik.addUserToGroup(authentikUser, group);
            console.log(`Added user ${authentikUser.username} (${authentikUser.pk}) to group ${group.name} (${group.pk}).`);
        } else if (!hasRole && inGroup) {
            // Remove user from group
            await authentik.removeUserFromGroup(authentikUser, group);
            console.log(`Removed user ${authentikUser.username} (${authentikUser.pk}) from group ${group.name} (${group.pk}).`);
        }
    }
}