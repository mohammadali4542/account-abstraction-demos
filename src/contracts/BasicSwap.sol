// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BasicSwap is Ownable, ReentrancyGuard {
    IERC20 public outputToken;
    uint256 private constant RATE = 990; // 99% (1000 = 100%)
    uint256 private constant BASE = 1000;

    event OutputTokenSet(address indexed token);
    event TokensDeposited(address indexed depositor, uint256 amount);
    event TokensSwapped(
        address indexed user,
        address indexed inputToken,
        uint256 inputAmount,
        uint256 outputAmount
    );

    constructor(
        address _outputToken,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_outputToken != address(0), "Invalid token address");
        outputToken = IERC20(_outputToken);
    }

    /**
     * @dev Sets the output token that users will receive when swapping
     * @param _newOutputToken Address of the new output token
     */
    function setOutputToken(address _newOutputToken) external onlyOwner {
        require(_newOutputToken != address(0), "Invalid token address");
        outputToken = IERC20(_newOutputToken);
        emit OutputTokenSet(_newOutputToken);
    }

    /**
     * @dev Allows the owner to deposit output tokens to the contract
     * @param _amount Amount of tokens to deposit
     */
    function depositOutputTokens(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than 0");
        require(
            outputToken.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
        emit TokensDeposited(msg.sender, _amount);
    }

    /**
     * @dev Calculates the output amount based on the input amount
     * @param _inputAmount Amount of input tokens
     * @return Output amount of tokens
     */
    function getOutputAmount(uint256 _inputAmount) public pure returns (uint256) {
        return (_inputAmount * RATE) / BASE;
    }

    /**
     * @dev Swaps input tokens for output tokens
     * @param _inputToken Address of the token to swap
     * @param _inputAmount Amount of tokens to swap
     */
    function swap(
        address _inputToken,
        uint256 _inputAmount
    ) external nonReentrant {
        require(_inputAmount > 0, "Amount must be greater than 0");
        require(_inputToken != address(0), "Invalid input token");
        require(_inputToken != address(outputToken), "Cannot swap same token");

        uint256 outputAmount = getOutputAmount(_inputAmount);
        require(
            outputToken.balanceOf(address(this)) >= outputAmount,
            "Insufficient output token balance"
        );

        // Transfer input tokens from user to contract
        IERC20 inputTokenContract = IERC20(_inputToken);
        require(
            inputTokenContract.transferFrom(msg.sender, address(this), _inputAmount),
            "Input token transfer failed"
        );

        // Transfer output tokens to user
        require(
            outputToken.transfer(msg.sender, outputAmount),
            "Output token transfer failed"
        );

        emit TokensSwapped(msg.sender, _inputToken, _inputAmount, outputAmount);
    }

    /**
     * @dev Allows the owner to withdraw any tokens from the contract
     * @param _token Address of the token to withdraw
     * @param _amount Amount of tokens to withdraw
     */
    function withdrawTokens(
        address _token,
        uint256 _amount
    ) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        
        IERC20 token = IERC20(_token);
        require(
            token.transfer(msg.sender, _amount),
            "Transfer failed"
        );
    }

    /**
     * @dev Returns the contract's balance of output tokens
     */
    function getOutputTokenBalance() external view returns (uint256) {
        return outputToken.balanceOf(address(this));
    }
}