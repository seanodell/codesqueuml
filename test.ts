let fs = require('fs');
let path = require('path');
let shell = require('shelljs');

import * as CodesqueUML from './index';

async function buildFile(filename: string, outputDir: string, componentIdMap: Map<string, string>) {
  let pumlFilename = outputDir + '/' + filename.replace("#", ".").replace(/[/\\]/, ".")
    .replace(/\.[^.]+$/, ".puml")
  let svgFilename = pumlFilename.replace(/\.[^.]+$/, ".svg")

  let lines = fs.readFileSync(filename).toString().split("\n");

  try {
    let parser = new CodesqueUML.Parser(lines);
    let rootNodes = parser.parse();
    if (rootNodes != undefined) {
      let plantUML = CodesqueUML.renderPlantUML(rootNodes, componentIdMap);
      await CodesqueUML.savePlantUMLSVG(plantUML, svgFilename);
      fs.writeFileSync(pumlFilename, plantUML);
    }
  } catch (e) {
    throw e;
  }
}

(async() => {
shell.rm('-rf', 'output');
shell.mkdir('output');

let files = fs.readdirSync('examples')
  .filter((filename: string) => filename.endsWith(".code"));

  let componentIdMap: Map<string, string> = new Map();

  files.forEach((filename: string) => {
    let componentId = path.basename(filename).replace(/\.[^.]+$/, "");
    let svgFilename = 'examples.' + filename.replace("#", ".").replace(/[/\\]/, ".")
      .replace(/\.[^.]+$/, ".svg");
    componentIdMap.set(componentId, svgFilename);
  });

  files.forEach((filename: string) => {
    console.log(`Building examples/${filename}`);
    buildFile(`examples/${filename}`, 'output', componentIdMap);
  });
})();
