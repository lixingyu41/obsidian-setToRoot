# Set to Root

Open additional File Explorer tabs rooted to a specific folder.

Desktop only.

## Features

- Adds `Set to root` / `设置为根目录` to the folder context menu in the default File Explorer.
- Opens a dedicated rooted explorer view without changing Obsidian's built-in full-vault File Explorer.
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

Install dependencies:

```bash
npm install
```

Start a development build that watches source files:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Before submitting a release, update `manifest.json`, `versions.json`, and create a GitHub release whose tag matches the manifest version. The release must include `main.js`, `manifest.json`, and `styles.css`.

## License

MIT
