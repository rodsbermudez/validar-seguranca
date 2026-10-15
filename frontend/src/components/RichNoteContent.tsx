import React, { useState } from 'react';
import { Box, Code, Anchor, Text, ActionIcon, Tooltip, Group, Badge } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

interface RichNoteContentProps {
  content: string;
}

export const RichNoteContent: React.FC<RichNoteContentProps> = ({ content }) => {
  if (!content) return null;

  // Quebrar por blocos de código markdown (```lang\ncode\n```)
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: Array<{ type: 'code' | 'text'; language?: string; code?: string; text?: string }> = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        text: content.substring(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'code',
      language: match[1]?.trim() || 'code',
      code: match[2]?.trimEnd() || '',
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      text: content.substring(lastIndex),
    });
  }

  return (
    <Box style={{ wordBreak: 'break-word', lineHeight: 1.6 }}>
      {parts.map((part, index) => {
        if (part.type === 'code' && part.code !== undefined) {
          return (
            <CodeBlockItem
              key={index}
              code={part.code}
              language={part.language || 'code'}
            />
          );
        }

        return <TextWithLinks key={index} text={part.text || ''} />;
      })}
    </Box>
  );
};

// Componente para Bloco de Código com Botão de Cópia
const CodeBlockItem: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      my="xs"
      p="xs"
      bg="dark.9"
      style={{
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
      }}
    >
      <Group justify="space-between" align="center" mb={4}>
        <Badge size="xs" variant="light" color="indigo" radius="xs">
          {language.toUpperCase()}
        </Badge>
        <Tooltip label={copied ? 'Copiado!' : 'Copiar código'}>
          <ActionIcon
            size="xs"
            variant="subtle"
            color={copied ? 'teal' : 'gray'}
            onClick={handleCopy}
          >
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      </Group>

      <Code
        block
        style={{
          backgroundColor: 'transparent',
          color: '#e2e8f0',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          overflowX: 'auto',
          padding: 0,
        }}
      >
        {code}
      </Code>
    </Box>
  );
};

// Renderizador de texto comum com detecção de links e inline code
const TextWithLinks: React.FC<{ text: string }> = ({ text }) => {
  // Regex combinando links markdown [label](url), URLs automáticas e inline code `code`
  const combinedRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<]+)|(`([^`]+)`)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <span key={`text-${lastIndex}`}>
          {renderFormattedLines(text.substring(lastIndex, match.index))}
        </span>
      );
    }

    if (match[1]) {
      // Markdown link: [Label](url)
      const label = match[2];
      const url = match[3];
      elements.push(
        <Anchor
          key={`md-link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          c="blue.4"
          fw={500}
          underline="hover"
        >
          {label}
        </Anchor>
      );
    } else if (match[4]) {
      // Plain URL
      const url = match[4];
      elements.push(
        <Anchor
          key={`url-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          c="blue.4"
          fw={500}
          underline="hover"
        >
          {url}
        </Anchor>
      );
    } else if (match[5]) {
      // Inline code `code`
      const inlineCode = match[6];
      elements.push(
        <Code key={`inline-code-${match.index}`} color="dark.6" c="indigo.2">
          {inlineCode}
        </Code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(
      <span key={`text-${lastIndex}`}>
        {renderFormattedLines(text.substring(lastIndex))}
      </span>
    );
  }

  return <Text component="div" size="sm" c="gray.3">{elements}</Text>;
};

// Renderiza quebras de linha preservando parágrafos
const renderFormattedLines = (plainText: string) => {
  const lines = plainText.split('\n');
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </React.Fragment>
  ));
};
