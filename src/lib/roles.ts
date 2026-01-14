import settings from "@/settings/settings.json";

/**
 * Filter roles to only show:
 * - Roles listed in settings.json
 * - Roles containing "steward" (case insensitive)
 */
export function getDisplayRoles(
  roleDetails: Array<{ id: string; name: string }>
): Array<{ id: string; name: string }> {
  if (!roleDetails || roleDetails.length === 0) {
    return [];
  }

  // Get all role IDs from settings
  const settingsRoleIds = Object.values(settings.discord.roles);

  return roleDetails.filter((role) => {
    // Show if role is in settings.json
    if (settingsRoleIds.includes(role.id)) {
      return true;
    }

    // Show if role name contains "steward" (case insensitive)
    if (role.name.toLowerCase().includes("steward")) {
      return true;
    }

    return false;
  });
}
