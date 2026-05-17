# Set to Root

Open additional File Explorer tabs rooted to a specific folder.

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

Install dependencies once:

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

Release format:

- Keep `package.json` and `manifest.json` on the same `x.y.z` version.
- Update `versions.json` through `npm version patch`, `npm version minor`, or `npm version major`.
- Create a GitHub release whose tag matches the manifest version.
- Attach `main.js`, `manifest.json`, and `styles.css` to the release.

## License

MIT
