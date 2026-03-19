import type {
  FieldNode,
  GraphQLResolveInfo,
  SelectionNode,
} from 'graphql';

function walkSelection(
  node: SelectionNode,
  fragments: GraphQLResolveInfo['fragments'],
  path: string[],
  out: Set<string>
) {
  if (node.kind === 'Field') {
    if (node.name.value === '__typename') return;

    const nextPath = [...path, node.name.value];
    out.add(nextPath.join('.'));

    node.selectionSet?.selections.forEach((selection) =>
      walkSelection(selection, fragments, nextPath, out)
    );
    return;
  }

  if (node.kind === 'InlineFragment') {
    node.selectionSet.selections.forEach((selection) =>
      walkSelection(selection, fragments, path, out)
    );
    return;
  }

  if (node.kind === 'FragmentSpread') {
    const fragment = fragments[node.name.value];
    if (!fragment) return;

    fragment.selectionSet.selections.forEach((selection) =>
      walkSelection(selection, fragments, path, out)
    );
  }
}

export function getSelectedPaths(
  info?: GraphQLResolveInfo,
  fieldNodes?: readonly FieldNode[]
) {
  const selectedPaths = new Set<string>();
  if (!info) return selectedPaths;

  const nodes = fieldNodes ?? info.fieldNodes;

  nodes.forEach((fieldNode) => {
    fieldNode.selectionSet?.selections.forEach((selection) =>
      walkSelection(selection, info.fragments, [], selectedPaths)
    );
  });

  return selectedPaths;
}

export function hasSelectedPath(
  selectedPaths: Set<string>,
  pathPrefix: string
) {
  return Array.from(selectedPaths).some(
    (path) => path === pathPrefix || path.startsWith(`${pathPrefix}.`)
  );
}
