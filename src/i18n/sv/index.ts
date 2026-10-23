import core from "./core";
import account from "./account";
import admin from "./admin";
import chat from "./chat";
import community from "./community";
import content from "./content";

/** Swedish: English text → Swedish, one file per part of the site. */
const sv: Record<string, string> = { ...core, ...account, ...admin, ...chat, ...community, ...content };

export default sv;
