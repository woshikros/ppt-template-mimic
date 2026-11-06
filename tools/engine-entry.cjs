exports.Automizer=require('pptx-automizer').Automizer;
exports.JSZip=require('jszip');
const xml=require('@xmldom/xmldom');
exports.DOMParser=xml.DOMParser;
exports.XMLSerializer=xml.XMLSerializer;
exports.engineVersion=require('pptx-automizer/package.json').version;
