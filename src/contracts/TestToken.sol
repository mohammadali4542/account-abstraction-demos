// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract TestToken is ERC20Permit {
    constructor() ERC20("Test Token", "TEST") ERC20Permit("Test Token") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}