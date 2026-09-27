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
      return <FileText {...iconProps} className={`${iconProps.className} text-blue-500`} />;
    case 'js':
      return <SiJavascript {...iconProps} className={`${iconProps.className} text-yellow-500`} />;
    case 'jsx':
      return <SiReact {...iconProps} className={`${iconProps.className} text-cyan-500`} />;
    case 'ts':
      return <SiTypescript {...iconProps} className={`${iconProps.className} text-blue-500`} />;
    case 'tsx':
      return <SiReact {...iconProps} className={`${iconProps.className} text-cyan-500`} />;
    case 'py':
      return <SiPython {...iconProps} className={`${iconProps.className} text-blue-400`} />;
    case 'c':
      return <SiC {...iconProps} className={`${iconProps.className} text-blue-600`} />;
    case 'cpp':
    case 'cxx':
    case 'cc':
    case 'h':
    case 'hpp':
      return <SiCplusplus {...iconProps} className={`${iconProps.className} text-blue-600`} />;
    case 'java':
      return <FaJava {...iconProps} className={`${iconProps.className} text-red-500`} />;
    case 'html':
      return <SiHtml5 {...iconProps} className={`${iconProps.className} text-orange-500`} />;
    case 'css':
    case 'scss':
      return <SiCss {...iconProps} className={`${iconProps.className} text-blue-500`} />;
    case 'rs':
      return <SiRust {...iconProps} className={`${iconProps.className} text-orange-600`} />;
    case 'go':
      return <SiGo {...iconProps} className={`${iconProps.className} text-cyan-500`} />;
    case 'php':
      return <SiPhp {...iconProps} className={`${iconProps.className} text-indigo-400`} />;
    case 'rb':
      return <SiRuby {...iconProps} className={`${iconProps.className} text-red-500`} />;
    case 'swift':
      return <SiSwift {...iconProps} className={`${iconProps.className} text-orange-500`} />;
    case 'json':
      return <FileCode {...iconProps} className={`${iconProps.className} text-amber-500/80`} />;
    case 'txt':
    case 'rst':
      return <FileText size={14} className="text-gray-400 flex-shrink-0" />;
    case 'yml':
    case 'yaml':
    case 'toml':
    case 'xml':
      return <FileCode size={14} className="text-amber-500/80 flex-shrink-0" />;
    case 'sh':
    case 'bash':
      return <FileCode size={14} className="text-green-500/80 flex-shrink-0" />;
    default:
      return <FileText size={14} className="text-gray-400 flex-shrink-0" />;
  }
}
