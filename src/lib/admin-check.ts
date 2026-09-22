import { auth } from "@/auth";
import settings from "@/settings/settings.json";

/**
 * Check if the current user has the Discord "member" role on the guild.
 * Used to gate inline editing on the finance tables.
 */
export async function isMember(): Promise<boolean> {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles;
  if (!roles) return false;
  const memberRoleId = settings.discord.roles.member;
  return roles.includes(memberRoleId);
}

/**
 * Whether the signed-in user holds a steward role on the guild: any role
 * whose name contains "steward" (as the /stewards page defines it), or the
 * role id in settings.discord.roles.steward when one is configured.
 */
export async function isSteward(): Promise<boolean> {
  const session = await auth();
  const user = session?.user as { roles?: string[]; roleDetails?: Array<{ id: string; name: string }> } | undefined;
  if (!user) return false;
  const stewardRoleId = (settings.discord.roles as { steward?: string }).steward;
  if (stewardRoleId && user.roles?.includes(stewardRoleId)) return true;
  return (user.roleDetails ?? []).some((role) => role.name.toLowerCase().includes("steward"));
}

/**
 * Check if the current user is an admin of the Discord guild
 * Admins are users who have the Administrator permission flag
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();

  if (!session || !session.user) {
    return false;
  }

  const accessToken = session.user.accessToken;
  if (!accessToken) {
    return false;
  }

  try {
    // Fetch the member object which includes permissions
    const memberResponse = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${settings.discord.guildId}/member`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!memberResponse.ok) {
      console.error(
        "Failed to fetch Discord member:",
        memberResponse.status,
        memberResponse.statusText
      );
      return false;
    }

    const member = await memberResponse.json();

    // Check if user has administrator permissions
    // Administrator permission flag is 0x8 (8 in decimal)
    // Permissions can be a string or number
    if (!member.permissions) {
      return false;
    }

    const permissionsValue = member.permissions;
    const permissions =
      typeof permissionsValue === "string"
        ? BigInt(permissionsValue)
        : BigInt(permissionsValue);
    const ADMINISTRATOR_PERMISSION = BigInt(0x8);

    return (
      (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION
    );
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}


