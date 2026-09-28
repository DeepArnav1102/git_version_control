import React from 'react';
import { FileText, FileCode } from 'lucide-react';
import { 
  SiC, 
  SiCplusplus, 
  SiPython, 
  SiJavascript, 
  SiTypescript, 
  SiHtml5, 
  SiCss, 
  SiReact, 
  SiRust, 
  SiGo, 
  SiPhp,
  SiRuby,
  SiSwift
} from 'react-icons/si';
import { FaJava } from 'react-icons/fa';

export function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  
  const iconProps = { size: 14, className: "flex-shrink-0" };

  switch (ext) {
    case 'md':
    case 'markdown':
      return <FileText {...iconProps} color="#083fa1" />;
    case 'js':
      return <SiJavascript {...iconProps} color="#F7DF1E" />;
    case 'jsx':
      return <SiReact {...iconProps} color="#61DAFB" />;
    case 'ts':
      return <SiTypescript {...iconProps} color="#3178C6" />;
    case 'tsx':
      return <SiReact {...iconProps} color="#3178C6" />;
    case 'py':
      return <SiPython {...iconProps} color="#3776AB" />;
    case 'c':
      return <SiC {...iconProps} color="#A8B9CC" />;
    case 'cpp':
    case 'cxx':
    case 'cc':
    case 'h':
    case 'hpp':
      return <SiCplusplus {...iconProps} color="#00599C" />;
    case 'java':
      return <FaJava {...iconProps} color="#007396" />;
    case 'html':
      return <SiHtml5 {...iconProps} color="#E34F26" />;
    case 'css':
    case 'scss':
      return <SiCss {...iconProps} color="#1572B6" />;
    case 'rs':
      return <SiRust {...iconProps} color="#000000" />;
    case 'go':
      return <SiGo {...iconProps} color="#00ADD8" />;
    case 'php':
      return <SiPhp {...iconProps} color="#777BB4" />;
    case 'rb':
      return <SiRuby {...iconProps} color="#CC342D" />;
    case 'swift':
      return <SiSwift {...iconProps} color="#F05138" />;
    case 'json':
      return <FileCode {...iconProps} color="#CBCB41" />;
    case 'txt':
    case 'rst':
      return <FileText size={14} color="#8c929d" className="flex-shrink-0" />;
    case 'yml':
    case 'yaml':
    case 'toml':
    case 'xml':
      return <FileCode size={14} color="#CB3837" className="flex-shrink-0" />;
    case 'sh':
    case 'bash':
      return <FileCode size={14} color="#4EAA25" className="flex-shrink-0" />;
    default:
      return <FileText size={14} color="#8c929d" className="flex-shrink-0" />;
  }
}
