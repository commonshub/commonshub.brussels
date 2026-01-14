/**
 * Contributors data types
 * Generated from data/{year}/{month}/contributors.json
 */

export interface ContributorProfile {
  name: string;
  username: string;
  description: string | null;
  avatar_url: string;
  roles: string[];
}

export interface ContributorTokens {
  in: number;
  out: number;
}

export interface ContributorDiscord {
  messages: number;
  mentions: number;
}

export interface Contributor {
  id: string;
  profile: ContributorProfile;
  tokens: ContributorTokens;
  discord: ContributorDiscord;
  address: string;
}

export interface ContributorsSummary {
  totalContributors: number;
  contributorsWithAddress: number;
  contributorsWithTokens: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalMessages: number;
}

export interface ContributorsFile {
  year: string;
  month: string;
  summary: ContributorsSummary;
  contributors: Contributor[];
}
