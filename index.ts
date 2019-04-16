let fs = require('fs');
let plantuml = require('node-plantuml');



export class ParseError implements Error {
  name: string = "ParseError";
  message: string;
  constructor(message: string) {
    this.message = message;
  }
}

export function throwLineError(line: number, message: string): never {
  throw new ParseError(`${message} at line ${line + 1}`);
}


abstract class Node {
  lineIndex: number;
  lineValue: string;

  indent: number;

  next: Node|undefined;

  parent: Node|undefined;
  children: Node[] = [];

  constructor(lineIndex: number, lineValue: string, indent: number) {
    this.lineIndex = lineIndex;
    this.lineValue = lineValue;
    this.indent = indent;
  }

  abstract render(): string|undefined;
};


class EmptyNode extends Node {
  private static readonly pattern = /^\s*$/;

  static parse(lineIndex: number, lineValue: string): Node|undefined {
    let match: string[]|null = EmptyNode.pattern.exec(lineValue);
    if (match != null)
      return new EmptyNode(lineIndex, lineValue, 0);
  }

  render(): undefined {
    return undefined;
  }
}


abstract class BlockNode extends Node {
  abstract renderStartUML(): string;
  abstract renderEndUML(): string;
}


export abstract class ComponentNode extends BlockNode {
  static getComponentParent(childNode: Node): ComponentNode|undefined {
    let componentParent: Node|undefined = childNode.parent;
    while (componentParent != undefined && !(componentParent instanceof ComponentNode))
      componentParent = componentParent.parent;
    return componentParent;
  }

  abstract getGroup(): string;
  abstract getComponent(): string;
  abstract getDescription(): string;
}



class MethodNode extends ComponentNode {
  className: string;
  methodName: string;
  callComment: string;
  returnComment: string;

  private constructor(lineIndex: number, lineValue: string, indent: number,
    className: string, methodName: string, callComment: string, returnComment: string) {
    super(lineIndex, lineValue, indent);
    this.className = className;
    this.methodName = methodName;
    this.callComment = callComment;
    this.returnComment = returnComment;
  }

  private static readonly pattern = /^(\s*)(([A-Za-z$_][A-Za-z0-9$_]+)#)?([A-Za-z$_][A-Za-z0-9$_]+)\(\)(\s*:\s*(.*?)\s*)?(\s*<\s*(.*)\s*)?$/;

  static parse(lineIndex: number, lineValue: string): Node|undefined {
    let match: string[]|null = MethodNode.pattern.exec(lineValue);
    if (match != null)
      return new MethodNode(lineIndex, lineValue, match[1].length, match[3], match[4], match[6], match[8]);
  }

  render(): string {
    let statement = "";
    if (this.className != undefined)
      statement += `${this.className}#`
    statement += `${this.methodName}()`;
    if (this.callComment != undefined)
      statement += `: ${this.callComment}`
      if (this.returnComment != undefined)
        statement += `: ${this.returnComment}`
    return statement;
  }

  renderStartUML(): string {
    let componentParent = ComponentNode.getComponentParent(this);
    let uml = "";
    if (componentParent) {
      uml += `"${componentParent.getComponent()}" -> "${this.methodName}()"`
      if (this.callComment)
        uml += `: ${this.callComment}`;
    }
    uml += `\nactivate "${this.methodName}()"`;
    return uml;
  }

  renderEndUML(): string {
    let uml = "";
    let componentParent = ComponentNode.getComponentParent(this);
    if (componentParent) {
      if (this.returnComment)
        uml = `"${this.methodName}()" --> "${componentParent.getComponent()}": ${this.returnComment}`
      else
        uml = `"${this.methodName}()" --> "${componentParent.getComponent()}"`
    }
    uml += `\ndeactivate "${this.methodName}()"`;
    return uml;
  }

  getGroup(): string {
    return this.className;
  }

  getComponent(): string {
    return `${this.methodName}()`;
  }

  getDescription(): string {
    return this.callComment;
  }
}



class LoopNode extends BlockNode {
  note: string;

  private constructor(lineIndex: number, lineValue: string, indent: number,
    note: string) {
    super(lineIndex, lineValue, indent);
    this.note = note;
  }

  private static readonly pattern = /^(\s*)(loop)(\s+)(\s*(.*)\s*)$/;

  static parse(lineIndex: number, lineValue: string): Node|undefined {
    let match: string[]|null = LoopNode.pattern.exec(lineValue);
    if (match != null)
      return new LoopNode(lineIndex, lineValue, match[1].length, match[5]);
  }

  render(): string {
    return `loop ${this.note}`;
  }

  renderStartUML(): string {
    return `loop ${this.note}`;
  }

  renderEndUML(): string {
    return "end loop";
  }
}



export let nodeParsers:{(index:number,value:string):Node|undefined}[] = [
  MethodNode.parse,
  LoopNode.parse
];



export class Parser {
  private index: number = 0;
  private readonly lines: string[];

  constructor(lines: string[]) {
    this.lines = lines;
  };

  private parseNode(): Node|undefined {
    while (this.index < this.lines.length && EmptyNode.parse(this.index, this.lines[this.index]) != undefined)
      this.index++;

    if (this.index >= this.lines.length)
      return undefined;

    let node: Node|undefined = (():Node|undefined => {
      for (let index in nodeParsers) {
        let node: Node|undefined = nodeParsers[index](this.index, this.lines[this.index]);
        if (node != undefined)
          return node;
      }
    })();

    if (node == undefined)
      throwLineError(this.index, `Unknown statement '${this.lines[this.index]}'`);

    return node;
  }

  private parseAllNodes(): Node|undefined {
    let firstNode: Node|undefined, node: Node|undefined, lastNode: Node|undefined;
    while (node = this.parseNode()) {
      if (lastNode != undefined)
        lastNode.next = node;
      else
        firstNode = node;
      lastNode = node;
      this.index++;
    }
    return firstNode;
  }

  private structureNodes(rootNode: Node): Node|undefined {
    let node: Node|undefined = rootNode.next;
    while(node != undefined && node.indent > rootNode.indent) {
      rootNode.children.push(node);
      node.parent = rootNode;

      if (node instanceof MethodNode && node.className == undefined) {
        let parentNode = node.parent;
        while (parentNode && !(parentNode instanceof MethodNode))
          parentNode = parentNode.parent;
        node.className = (parentNode as MethodNode).className;
      }

      node = this.structureNodes(node);
    }
    rootNode.next = undefined;
    return node;
  }

  parse(): ComponentNode[]|undefined {
    try {
      let rootNode: Node|undefined = this.parseAllNodes();

      if (rootNode != undefined) {
        let rootNodes: ComponentNode[] = [];

        while (rootNode) {
          if (!(rootNode instanceof ComponentNode))
            return throwLineError(rootNode.lineIndex, 'Top-level statement must be a component in the format \'Group#component()\'')
          if ((rootNode as ComponentNode).getGroup() == undefined)
            return throwLineError(rootNode.lineIndex, 'Top-level statement missing component group name');

          rootNodes.push(rootNode);
          rootNode = this.structureNodes(rootNode); // structures root and returns next top level node
        }

        return rootNodes;
      }
    } finally {
      this.index = 0;
    }
  };
};

export function renderNodeGraph(parentNode: Node): string|undefined {
  if (parentNode) {
    let result: string = " ".repeat(parentNode.indent) + parentNode.render() + "\n";

    parentNode.children.forEach((node) => {
      result += renderNodeGraph(node);
    });

    return result;
  }
}

function renderPlantUMLCallGraph(parentNode: Node): string[]|undefined {
  if (parentNode) {
    let plantUML: string[] = [];

    if (parentNode instanceof BlockNode) {
      plantUML.push(parentNode.renderStartUML());
    }
    parentNode.children.forEach((node) => {
      let children = renderPlantUMLCallGraph(node);
      if (children != undefined) {
        plantUML = plantUML.concat(children);
      }
    });
    if (parentNode instanceof BlockNode) {
      plantUML.push(parentNode.renderEndUML());
    }

    return plantUML;
  }
}

class ComponentGroups {
  groups = new Array<string>();
  groupComponents = new Map<string, string[]>();
  components = new Set<string>();

  addComponent(node: Node) {
    if (node instanceof ComponentNode) {
      let group = this.groupComponents.get(node.getGroup());
      if (group == undefined) {
        group = [];
        this.groupComponents.set(node.getGroup(), group);
        this.groups.push(node.getGroup());
      }

      let component = this.components.has(node.getComponent());
      if (!component) {
        this.components.add(node.getComponent());
        group.push(node.getComponent());
      }
    }

    node.children.forEach((childNode) => {
      this.addComponent(childNode);
    });
  }
}

function renderPlantUMLGroups(parentNode: Node): string[] {
  let groups = new ComponentGroups();

  groups.addComponent(parentNode);

  let plantUML: string[] = [];
  groups.groups.forEach((group) => {
    plantUML.push(`box "${group}"`);
    let components = groups.groupComponents.get(group);
    if (components)
      components.forEach((component) => {
        plantUML.push(`participant "${component}"`);
      });
    plantUML.push("end box");
  });
  return plantUML;
}

function renderRootNodePlantUML(rootNode: ComponentNode) {
  let plantUML: string[] = [];
  plantUML.push(`== ${rootNode.getDescription()} ==`);

  let groups = renderPlantUMLGroups(rootNode);
  plantUML = plantUML.concat(groups);

  let children = renderPlantUMLCallGraph(rootNode);
  if (children)
    plantUML = plantUML.concat(children);

  return plantUML.join("\n");
}

export function renderPlantUML(rootNodes: ComponentNode[]): string|never {
  if (rootNodes == null || rootNodes.length == 0)
    return throwLineError(0, "No components found");

  let parentNode = rootNodes[0];

  let plantUML: string[] = [];
  plantUML.push("@startuml");
  plantUML.push("skinparam ParticipantPadding 4");
  plantUML.push("skinparam BoxPadding 8");
  plantUML.push(`title ${parentNode.getGroup()}#${parentNode.getComponent()}`);

  rootNodes.forEach((rootNode) => {
    plantUML.push(renderRootNodePlantUML(rootNode));
  });

  plantUML.push("@enduml");
  return plantUML.join("\n");
}

export function savePlantUMLSVG(plantUML: string, filename: string) {
  let gen = plantuml.generate(plantUML, {format: 'svg'});
  gen.out.pipe(fs.createWriteStream(filename));
}
