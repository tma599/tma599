const express = require('express');
const bodyParser = require('body-parser');
const simpleGit = require('simple-git');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
const logDir = path.join(__dirname, 'ci-logs');

// ログディレクトリが存在しない場合は作成
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const event = req.headers['x-github-event'];
  if (event === 'push') {
    const repoUrl = req.body.repository.clone_url;
    const repoName = req.body.repository.name;
    const repoPath = path.join(__dirname, repoName);
    const logId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${repoName}`;
    const logFilePath = path.join(logDir, `${logId}.log`);
    const logStream = fs.createWriteStream(logFilePath);

    const log = (message) => {
      console.log(message);
      logStream.write(`[${new Date().toISOString()}] ${message}\n`);
    };

    log('New push event received.');
    res.status(202).send('Accepted');

    const runCommand = (command, cwd) => {
      return new Promise((resolve, reject) => {
        log(`Executing: ${command}`);
        const child = exec(command, { cwd });
        child.stdout.on('data', (data) => log(data.toString()));
        child.stderr.on('data', (data) => log(data.toString()));
        child.on('close', (code) => {
          if (code === 0) {
            log(`Command "${command}" completed successfully.`);
            resolve();
          } else {
            log(`Command "${command}" failed with exit code ${code}.`);
            reject(new Error(`Command failed: ${command}`));
          }
        });
      });
    };

    const git = simpleGit();
    (async () => {
      try {
        if (fs.existsSync(repoPath)) {
          log(`Repository ${repoName} already exists. Pulling latest changes.`);
          await git.cwd(repoPath).pull();
        } else {
          log(`Cloning repository ${repoName} from ${repoUrl}.`);
          await git.clone(repoUrl, repoPath);
        }
        await runCommand('npm install', repoPath);
        await runCommand('npm run lint', repoPath);
        await runCommand('npm test', repoPath);
        log('CI process completed successfully.');
      } catch (error) {
        log(`CI process failed: ${error.message}`);
      } finally {
        logStream.end();
      }
    })();
  } else {
    res.status(400).send('Unsupported event type.');
  }
});

app.get('/logs', (req, res) => {
  fs.readdir(logDir, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading log directory.');
    }
    const logFiles = files
      .filter((file) => file.endsWith('.log'))
      .map((file) => {
        return `<li><a href="/log/${path.basename(file, '.log')}">${file}</a></li>`;
      })
      .join('');
    res.send(`<ul>${logFiles}</ul>`);
  });
});

app.get('/log/:id', (req, res) => {
  const logFilePath = path.join(logDir, `${req.params.id}.log`);
  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).send('Log file not found.');
    }
    res.header('Content-Type', 'text/plain; charset=utf-8').send(data);
  });
});

app.listen(port, () => {
  console.log(`CI server listening at http://localhost:${port}`);
});
