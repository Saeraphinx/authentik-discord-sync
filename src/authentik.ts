import { Configuration, CoreApi, User as AuthentikUser, Group } from "@goauthentik/api";

export { User as AuthentikUser } from "@goauthentik/api";

export class AuthentikClient {
    private config: Configuration;
    private coreApi: CoreApi;
    private authentikUserPath: string;

    constructor(options: {
        url: string;
        apiKey: string;
        authentikUserPath?: string;
    }) {
        if (!options.url) {
            throw new Error("Authentik URL is required");
        }
        if (!options.apiKey) {
            throw new Error("Authentik API Key is required");
        }
        if (options.authentikUserPath) {
            this.authentikUserPath = options.authentikUserPath;
        } else {
            this.authentikUserPath = "goauthentik.io/sources/discord-oa";
        }
        this.config = new Configuration({
            basePath: options.url,
            accessToken: options.apiKey,

        });
        this.coreApi = new CoreApi(this.config);
    }

    public async getAllGroups(includeUsers: boolean = false) {
        let groups = await this.coreApi.coreGroupsList({ pageSize: 1000, includeUsers })
        return groups.results
    }

    public async getSyncableGroups(includeUsers: boolean = false) {
        let groups = await this.coreApi.coreGroupsList({ pageSize: 1000, includeUsers });
        return groups.results.filter(group => group.attributes && group.attributes['discord_role_id'] !== undefined);
    }

    /*
      Returns a mapping of Discord Role IDs to Authentik Group IDs for all syncable groups.
      key: Discord Role ID (string)
      value: Array of User Ids (number[])
    public async groupsToIDArray() {
        let groups = await this.getSyncableGroups(true);
        let groupMap: { [key: string]: number[] } = {};
        for (let group of groups) {
            let discordRoleId = group.attributes!['discord_role_id'];
            if (discordRoleId) {
                groupMap[discordRoleId] = group.usersObj?.map(user => user.attributes?.id as number) || [];
            }
        }
        return groupMap;
    }*/

    public async getAllSyncedUsers() {
        let users = await this.coreApi.coreUsersList({ pageSize: 1000, path: this.authentikUserPath });
        return users.results;
    }

    public async getUserByDiscordId(discord_id: string) {
        let users = await this.coreApi.coreUsersList({ pageSize: 1, attributes: JSON.stringify({ discord_id: discord_id }, null, 0) });
        if (users.results.length > 0) {
            return users.results[0];
        } else {
            return null;
        }
    }

    public async updateUserAttributes(user: AuthentikUser, attributes: {
        username?: string;
        name?: string;
        avatar?: string;
        is_active?: boolean;
    }) {    
        // check if attributes are already set to avoid unnecessary updates
        if (
            (user.username === attributes.username || attributes.username === undefined) &&
            (user.name === attributes.name || attributes.name === undefined) &&
            (user.attributes?.avatar === attributes.avatar || attributes.avatar === undefined) &&
            (user.isActive === attributes.is_active || attributes.is_active === undefined)
        ) {
            console.debug(`No update needed for Authentik user ${user.username} (${user.pk})`);
            return user; // no update needed
        }

        //console.debug(`Updating Authentik user ${user.username} (${user.pk})`);
        let userUpdate = await this.coreApi.coreUsersPartialUpdate({
            id: user.pk,
            patchedUserRequest: {
                username: attributes.username,
                name: attributes.name,
                attributes: {
                    ...user.attributes,
                    avatar: attributes.avatar,
                },
                isActive: attributes.is_active,
            }
        });
        return userUpdate;
    }

    public async addUserToGroup(user: AuthentikUser, group: Group) {
        return await this.coreApi.coreGroupsAddUserCreate({
            groupUuid: group.pk,
            userAccountRequest: {
                pk: user.pk
            }
        })
    }

    public async removeUserFromGroup(user: AuthentikUser, group: Group) {
        return await this.coreApi.coreGroupsRemoveUserCreate({
            groupUuid: group.pk,
            userAccountRequest: {
                pk: user.pk
            }
        })
    }
}