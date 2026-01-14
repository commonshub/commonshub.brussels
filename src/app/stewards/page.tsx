"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Coins, Users, AlertCircle } from "lucide-react";
import roles from "@/settings/roles.json";

interface RoleMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

interface RoleWithMembers {
  id: string;
  name: string;
  amountToMint: number;
  amountToBurn: number;
  frequency: string;
  members: RoleMember[];
}

export default function StewardsPage() {
  const [rolesWithMembers, setRolesWithMembers] = useState<RoleWithMembers[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoleMembers() {
      // Filter roles that earn tokens (amountToMint > 0)
      const earningRoles = roles.filter((role) => role.amountToMint > 0);

      const rolesData = await Promise.all(
        earningRoles.map(async (role) => {
          try {
            const res = await fetch(
              `/api/discord/role-members?roleId=${role.id}`
            );
            const data = await res.json();
            return {
              ...role,
              members: data.members || [],
            };
          } catch {
            return { ...role, members: [] };
          }
        })
      );

      // Sort by tokens earned (highest first)
      rolesData.sort((a, b) => b.amountToMint - a.amountToMint);
      setRolesWithMembers(rolesData);
      setLoading(false);
    }

    fetchRoleMembers();
  }, []);

  const filledRoles = rolesWithMembers.filter(
    (role) => role.members.length > 0
  );
  const vacantRoles = rolesWithMembers.filter(
    (role) => role.members.length === 0
  );

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/economy"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to economy
        </Link>
      </div>

      {/* Hero Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Community Stewards
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Stewards are community members who take responsibility for a
              specific part of our common space. In return, they receive tokens
              every week for their ongoing contribution.
            </p>
          </div>
        </div>
      </section>

      {/* Filled Roles */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
              Active Stewards
            </h2>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted/50 rounded-xl p-6 animate-pulse h-40"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filledRoles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-card rounded-xl p-6 shadow-sm border border-border"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-foreground text-lg">
                        {role.name}
                      </h3>
                      <div className="flex items-center gap-1 text-primary font-bold text-lg">
                        <Coins className="w-5 h-5" />
                        <span>{role.amountToMint}</span>
                        <span className="text-sm text-muted-foreground font-normal">
                          /{role.frequency === "weekly" ? "wk" : "mo"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>
                          {role.members.length} steward
                          {role.members.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {role.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-muted">
                              {member.avatar ? (
                                <Image
                                  src={member.avatar || "/placeholder.svg"}
                                  alt={member.displayName}
                                  width={24}
                                  height={24}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-medium">
                                  {member.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="text-sm">
                              {member.displayName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Vacant Roles */}
      {!loading && vacantRoles.length > 0 && (
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <AlertCircle className="w-6 h-6 text-primary" />
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  Current Vacancies
                </h2>
              </div>

              <p className="text-lg text-muted-foreground mb-8">
                Join the community and pick up one of these roles to earn tokens
                every week!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vacantRoles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-background rounded-xl p-5 shadow-sm border border-dashed border-primary/50"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">
                        {role.name}
                      </h3>
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <Coins className="w-4 h-4" />
                        <span>{role.amountToMint}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          /{role.frequency === "weekly" ? "wk" : "mo"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 text-center">
                <Link
                  href="/membership"
                  className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Become a member
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
