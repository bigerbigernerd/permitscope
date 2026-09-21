// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice DEMO: no economic value; deployed only into an isolated EVM/testnet.
contract DemoPermitToken is ERC20, ERC20Permit {
    constructor(address owner)
        ERC20("Scope Test Dollar", "tUSD")
        ERC20Permit("Scope Test Dollar")
    {
        _mint(owner, 1000 * 10 ** decimals());
    }
}
