# Set to Root

An Obsidian plugin that opens additional File Explorer tabs rooted to a specific folder.

## Features

- Adds `Set to root` / `设置为根目录` to the folder context menu in the default File Explorer.
- Opens a new rooted File Explorer tab without changing Obsidian's built-in full-vault File Explorer.
- Supports either a single rooted view or multiple rooted views.
- Restores rooted views after restarting Obsidian.
- Lets you choose the icon used by rooted views from a searchable icon picker.

## Settings

- `Rooted view instances`
  - `Single view`: reuse one rooted explorer and replace its root folder.
  - `Multiple views`: open multiple rooted explorers.
- `Rooted view icon`
  - Choose the tab icon used by rooted explorer views.

## Development

```bash
npm install
npm run dev
```

To run a production build:

```bash
npm run build
```

## Releasing

Before creating a GitHub release:

1. Update `manifest.json` with the target plugin version and minimum supported Obsidian version.
2. Update `versions.json` with the mapping from plugin version to minimum Obsidian version.
3. Build the plugin with `npm run build`.
4. Create a GitHub release whose tag exactly matches the plugin version in `manifest.json`.
5. Upload these files to the release:
   - `manifest.json`
   - `main.js`
   - `styles.css`

## Community Plugin Submission

When submitting to [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases), the repository entry needs:

- `id`: `set-to-root`
- `name`: `Set to Root`
- `author`: `lixingyu`
- `description`: `Open additional File Explorer tabs rooted to a specific folder.`
- `repo`: `lixingyu41/obsidian-setToRoot`

## License

MIT
