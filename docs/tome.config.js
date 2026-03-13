export default {
  name: "Commons Hub Brussels",
  theme: {
    preset: "amber",
    mode: "auto",
  },
  navigation: [
    {
      group: "Getting Started",
      pages: ["index"],
    },
    {
      group: "Website",
      pages: ["website/events", "website/data", "website/rooms", "website/cron"],
    },
    {
      group: "Tools",
      pages: ["cli"],
    },
    {
      group: "Community",
      pages: ["elinor"],
    },
  ],
};
