// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@account-abstraction/contracts/core/UserOperationLib.sol";

/**
 * @title CustomPaymaster
 * @notice Simple paymaster that sponsors gas for whitelisted wallets
 * @dev Inherits from BasePaymaster for ERC-4337 compliance
 */
contract CustomPaymaster is BasePaymaster {
    using UserOperationLib for PackedUserOperation;

    // Mapping of wallet addresses that can use this paymaster
    mapping(address => bool) public sponsoredWallets;

    event WalletSponsored(address indexed wallet, bool sponsored);

    constructor(address _entryPoint, address _owner) BasePaymaster(IEntryPoint(_entryPoint)) {
        // Transfer ownership to the specified owner
        if (_owner != msg.sender) {
            transferOwnership(_owner);
        }
    }

    /**
     * @notice Add or remove a wallet from sponsorship
     * @param wallet Address of the smart wallet
     * @param sponsored Whether to sponsor this wallet
     */
    function setSponsoredWallet(address wallet, bool sponsored) external onlyOwner {
        sponsoredWallets[wallet] = sponsored;
        emit WalletSponsored(wallet, sponsored);
    }

    /**
     * @notice Add multiple wallets for sponsorship
     * @param wallets Array of wallet addresses
     */
    function batchSetSponsoredWallets(address[] calldata wallets, bool sponsored) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            sponsoredWallets[wallets[i]] = sponsored;
            emit WalletSponsored(wallets[i], sponsored);
        }
    }

    /**
     * @notice Sponsor a wallet for free (anyone can call, useful for onboarding)
     * @param wallet Address to sponsor
     */
    function sponsorWallet(address wallet) external {
        sponsoredWallets[wallet] = true;
        emit WalletSponsored(wallet, true);
    }

    /**
     * @notice Validate if this paymaster will sponsor the UserOperation
     * @dev This is called by the EntryPoint during UserOp validation
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal view override returns (bytes memory context, uint256 validationData) {
        // Get the sender (smart wallet address)
        address wallet = userOp.sender;

        // Check if this wallet is sponsored
        require(sponsoredWallets[wallet], "Wallet not sponsored");

        // Check if paymaster has enough funds
        require(
            paymasterBalance() >= maxCost,
            "Paymaster: insufficient funds"
        );

        // Return success (validationData = 0 means valid)
        // Context can be used in postOp, we don't need it here
        return ("", 0);
    }

    /**
     * @notice Post-operation hook (optional)
     * @dev Called after the UserOp is executed, can be used for refunds or logging
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        // Optional: Add custom logic here
        // For now, we just let the paymaster pay for gas
    }

    /**
     * @notice Get the current balance of this paymaster in EntryPoint
     */
    function paymasterBalance() public view returns (uint256) {
        return getDeposit();
    }

    // Note: Stake management functions (addStake, unlockStake, withdrawStake)
    // are inherited from BasePaymaster
}
