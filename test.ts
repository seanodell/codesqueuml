let fs = require('fs');

import * as CodesqueUML from './index';

let lines = fs.readFileSync('examples/Main#function.code').toString().split("\n");

try {
  let parser = new CodesqueUML.Parser(lines);
  let rootNodes = parser.parse();
  if (rootNodes != undefined) {
    let plantUML = CodesqueUML.renderPlantUML(rootNodes);
    CodesqueUML.savePlantUMLSVG(plantUML, "examples/Main#function.svg")
    fs.writeFileSync('examples/Main#function.puml', plantUML);
  }
} catch (e) {
  throw e;
}
