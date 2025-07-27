const fsp = require('fs/promises');
const path = require('path');
const { Collection } = require('discord.js');

async function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '../commands');
  const commandFolders = await fsp.readdir(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const stats = await fsp.stat(folderPath);
    if (stats.isDirectory()) {
      const commandFiles = (await fsp.readdir(folderPath)).filter((file) => file.endsWith('.js'));
      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
        } else {
          console.log(
            `[警告] ${filePath} のコマンドは、必要な "data" または "execute" プロパティを欠いています。`
          );
        }
      }
    }
  }
}

module.exports = { loadCommands };
