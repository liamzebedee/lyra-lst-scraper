// load all files from ../data/*.tsv
// replace the top row of the file

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

const files = fs.readdirSync(dataDir);

for(let file of files) {
    const filePath = path.join(dataDir, file);
    const contents = fs.readFileSync(filePath, 'utf8');
    const lines = contents.split('\n');
    const columns = ['Address', 'Arkham - Entity', 'Arkham - Twitter', 'Arkham - Tags'].join('\t')

    lines[0] = columns;

    fs.writeFileSync(filePath, lines.join('\n'));

    console.log(`Updated ${file}`);

}