# Set to Root

An Obsidian plugin that opens additional File Explorer tabs rooted to a specific folder.

Desktop only.

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

Do not commit `main.js` to the source repository. Keep it as a release artifact only.

## License

MIT
