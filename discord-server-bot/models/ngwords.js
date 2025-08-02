const fsp = require('fs/promises');
const path = require('path');
const wanakana = require('wanakana');
const kuromoji = require('kuromoji');

const ngWordsFilePath = path.join(__dirname, '..', 'ngwords.json');

// Map<guildId, Array<{original: string, normalized: string}>>
const ngWords = new Map();
let tokenizer;

// This function MUST be called and awaited at startup.
async function initializeNgWords() {
  return new Promise((resolve, reject) => {
    console.log('[NGワードモデル] Kuromojiの初期化を開始します...');
    kuromoji
      .builder({ dicPath: path.join(__dirname, '..', 'node_modules/kuromoji/dict') })
      .build(async (err, t) => {
        if (err) {
          console.error('[NGワードモデル] Kuromojiの初期化に失敗しました。', err);
          return reject(err);
        }
        tokenizer = t;
        console.log('[NGワードモデル] Kuromojiの準備ができました。');
        // Now that tokenizer is ready, load the words
        await loadNgWords();
        resolve();
      });
  });
}

async function normalizeJapanese(text) {
  if (!tokenizer) {
    // This should not happen if initializeNgWords is awaited correctly
    console.error('[NGワードモデル] Tokenizerが初期化されていません。');
    return wanakana.toHiragana(text).toLowerCase();
  }
  const tokens = tokenizer.tokenize(text);
  return tokens
    .map((token) =>
      token.reading ? wanakana.toHiragana(token.reading) : wanakana.toHiragana(token.surface_form)
    )
    .join('');
}

// This function is now internal, called by initializeNgWords
async function loadNgWords() {
  try {
    const data = await fsp.readFile(ngWordsFilePath, 'utf8');
    const parsedData = JSON.parse(data);
    let needsSave = false;

    for (const guildId in parsedData) {
      const words = parsedData[guildId];
      if (Array.isArray(words)) {
        if (words.every((w) => typeof w === 'string')) {
          needsSave = true;
          const newWords = [];
          for (const word of words) {
            if (word) {
              const normalized = await normalizeJapanese(word);
              newWords.push({ original: word, normalized });
            }
          }
          ngWords.set(guildId, newWords);
        } else {
          ngWords.set(
            guildId,
            words.filter((w) => w && w.original)
          );
        }
      }
    }

    if (needsSave) {
      console.log(
        '[NGワード] NGワードリストを読み込み、古い形式から新しい形式へのデータ移行を完了しました。ファイルを更新します。'
      );
      await saveNgWords();
    } else {
      console.log('[NGワード] NGワードリストを正常に読み込みました。');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[NGワード] ngwords.json が見つかりませんでした。新規作成します。');
    } else {
      console.error('[NGワード] NGワードリストの読み込み中にエラーが発生しました:', error);
    }
  }
}

async function saveNgWords() {
  try {
    const dataToSave = {};
    for (const [guildId, wordsArray] of ngWords.entries()) {
      dataToSave[guildId] = wordsArray;
    }
    await fsp.writeFile(ngWordsFilePath, JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (error) {
    console.error('[NGワード] NGワードリストの保存中にエラーが発生しました:', error);
  }
}

module.exports = { ngWords, initializeNgWords, saveNgWords, normalizeJapanese };
