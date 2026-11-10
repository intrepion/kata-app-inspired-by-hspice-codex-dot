import { simulate } from './engine.js';
self.onmessage = ({data}) => {
  try { self.postMessage({result:simulate(data.netlist,data.analysis)}); }
  catch(error) { self.postMessage({error:error.message}); }
};
