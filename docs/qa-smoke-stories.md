# EzStudy local smoke

Use one authenticated owner and a bound local Ez agent with the installed EzStudy
plugin. Record the Ez run, plugin receipt, and canonical content revision.

1. Through an authenticated channel to the bound agent, request a Program with
   Week 1 containing three readings and a synthesis. The native Ez agent reads the
   installed authoring skill, writes Markdown in its workspace and publishes
   through `ez eztudy publish`. Require four distinct Items with the shared
   `week-01` tag, one per requested activity, and the expected receipt revision.
   A single "Week 1" Item containing all activities fails this smoke even when
   `check` and `publish` succeed.
2. Ask what is published. The agent uses `ez eztudy list` and `ez eztudy show ID`;
   the shown revision matches the publication receipt. Verify the four Item IDs,
   titles, shared week tag and intended order, with no combined Week Item left in
   the active sequence. When repairing existing content, preserve its instructions
   and conditions and use the existing receipt for revision-safe publication.
3. Open the Program in the authenticated frontend and reload. The same title,
   four separate cards and Item order remain visible; each opens only its own
   activity. Chat history, when connected, comes from Ez.
4. Request a video, podcast and optional movie for that week. Discover/read the
   current installed authoring skill, preserve the existing readings, publish
   three separate media Items and read back their types, HTTPS URLs and receipt.
   In the signed-in frontend, reload and open each card: verify Video/Podcast/Movie
   labels, Watch/Listen/Find movie links, matching source URLs and learning notes.
   Keep the optional movie optional and the synthesis after its resources. An
   old Markdown-only publication or a media tag alone does not pass this check.
