const fsp = require('fs/promises');
const path = require('path');
const { Collection } = require('discord.js');

async function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '../commands');
  const commandItems = await fsp.readdir(commandsPath);

  for (const item of commandItems) {
    const itemPath = path.join(commandsPath, item);
    const stats = await fsp.stat(itemPath);

    if (stats.isDirectory()) {
      const commandFiles = (await fsp.readdir(itemPath)).filter((file) => file.endsWith('.js'));
      for (const file of commandFiles) {
        const filePath = path.join(itemPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
        } else {
          console.log(
            `[警告] ${filePath} のコマンドは、必要な "data" または "execute" プロパティを欠いています。`
          );
        }
      }
    } else if (item.endsWith('.js')) {
      const command = require(itemPath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.log(
          `[警告] ${itemPath} のコマンドは、必要な "data" または "execute" プロパティを欠いています。`
        );
      }
    }
  }
}

module.exports = { loadCommands };
