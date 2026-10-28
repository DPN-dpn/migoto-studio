export interface SymbolLocationRecord {
  name: string;        // Lowercase name or clean name
  rawName: string;
  kind: 'variable' | 'section';
  line: number;
  startCol: number;
  endCol: number;
  lineContent: string;
  section: string;
  filePath: string;
  namespace?: string;
}

export interface NamespaceExport {
  namespace: string;
  filePath: string;
  variables: Set<string>;
  sections: Set<string>;
  usedVariables: Set<string>;
  usedSections: Set<string>;
  declarations: SymbolLocationRecord[];
  usages: SymbolLocationRecord[];
}

export interface NamespaceGroup {
  namespace: string;
  files: string[];
  variables: Set<string>;
  sections: Set<string>;
}
