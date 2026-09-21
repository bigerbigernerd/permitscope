import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const source = fs.readFileSync('contracts/DemoPermitToken.sol', 'utf8');
const input = {
  language: 'Solidity', sources: { 'DemoPermitToken.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: (name) => {
  if (!name.startsWith('@openzeppelin/contracts/')) return { error: 'Unsupported import' };
  return { contents: fs.readFileSync(path.join('node_modules', name), 'utf8') };
} }));
const errors = (output.errors || []).filter((error) => error.severity === 'error');
if (errors.length) throw new Error(errors.map((error) => error.formattedMessage).join('\n'));
const contract = output.contracts['DemoPermitToken.sol'].DemoPermitToken;
fs.mkdirSync('src/generated', { recursive: true });
fs.writeFileSync('src/generated/token.json', JSON.stringify({
  compiler: solc.version(), abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
}, null, 2) + '\n');
console.log('Compiled DemoPermitToken from OpenZeppelin ERC20Permit.');
