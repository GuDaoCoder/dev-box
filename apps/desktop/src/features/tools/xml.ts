export const XML_INPUT_LIMIT = 2 * 1024 * 1024;

export type XmlTransformResult = {
  output?: string;
  error?: "INPUT_TOO_LARGE" | "INVALID_XML" | "UNSAFE_DTD";
};

function openTag(element: Element) {
  const attributes = Array.from(element.attributes, (attribute) => {
    const value = attribute.value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/\t/g, "&#9;")
      .replace(/\n/g, "&#10;")
      .replace(/\r/g, "&#13;");
    return ` ${attribute.name}="${value}"`;
  }).join("");
  return `<${element.tagName}${attributes}`;
}

function renderXmlNode(
  node: Node,
  depth: number,
  indent: string,
  compact: boolean,
  preserve: boolean,
): string {
  const serializer = new XMLSerializer();
  if (node.nodeType !== Node.ELEMENT_NODE) return serializer.serializeToString(node);

  const element = node as Element;
  const keepWhitespace = preserve || element.getAttribute("xml:space") === "preserve";
  const children = Array.from(element.childNodes);
  const hasText = children.some(
    (child) => child.nodeType === Node.TEXT_NODE && Boolean(child.textContent?.trim()),
  );
  const hasElements = children.some((child) => child.nodeType === Node.ELEMENT_NODE);

  // 混合内容和显式保留空白的子树原样序列化，避免改变其文本语义。
  if (keepWhitespace || hasText || (!hasElements && children.length > 0)) {
    return serializer.serializeToString(element);
  }

  const meaningfulChildren = children.filter(
    (child) => child.nodeType !== Node.TEXT_NODE || Boolean(child.textContent?.trim()),
  );
  const opening = openTag(element);
  if (meaningfulChildren.length === 0) return `${opening}/>`;

  if (compact) {
    return `${opening}>${meaningfulChildren
      .map((child) => renderXmlNode(child, depth + 1, indent, true, false))
      .join("")}</${element.tagName}>`;
  }
  const padding = indent.repeat(depth + 1);
  const body = meaningfulChildren
    .map((child) => `${padding}${renderXmlNode(child, depth + 1, indent, false, false)}`)
    .join("\n");
  return `${opening}>\n${body}\n${indent.repeat(depth)}</${element.tagName}>`;
}

export function transformXml(
  input: string,
  options: { compact: boolean; indent: 2 | 4; validateOnly?: boolean },
): XmlTransformResult {
  if (new TextEncoder().encode(input).byteLength > XML_INPUT_LIMIT) {
    return { error: "INPUT_TOO_LARGE" };
  }
  // 离线工具不解析 DTD 或实体，避免外部实体与实体膨胀攻击。
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(input)) return { error: "UNSAFE_DTD" };

  const parsed = new DOMParser().parseFromString(input, "application/xml");
  const root = parsed.documentElement;
  const parserError = Array.from(parsed.getElementsByTagName("parsererror")).some(
    (element) =>
      element.namespaceURI === "http://www.w3.org/1999/xhtml" ||
      Boolean(element.namespaceURI?.includes("parsererror")),
  );
  if (!root || parserError) {
    return { error: "INVALID_XML" };
  }
  if (options.validateOnly) return {};

  const declaration = /^\s*(<\?xml\s+[^?]*\?>)/i.exec(input)?.[1];
  const separator = options.compact ? "" : "\n";
  const content = Array.from(parsed.childNodes, (node) =>
    renderXmlNode(node, 0, " ".repeat(options.indent), options.compact, false),
  ).join(separator);
  return { output: declaration ? `${declaration}${separator}${content}` : content };
}
