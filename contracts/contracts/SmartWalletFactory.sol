// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./CustomSmartWallet.sol";

/**
 * @title SmartWalletFactory
 * @notice Factory contract to deploy CustomSmartWallet instances using CREATE2
 * @dev Ensures same wallet address across different chains
 */
contract SmartWalletFactory {
    // EntryPoint address (same on all chains for ERC-4337)
    address public immutable entryPoint;

    // Event emitted when a wallet is created
    event WalletCreated(
        address indexed wallet,
        address indexed owner,
        bytes32 indexed salt
    );

    constructor(address _entryPoint) {
        require(_entryPoint != address(0), "Invalid entryPoint");
        entryPoint = _entryPoint;
    }

    /**
     * @notice Create a new smart wallet
     * @param owner The owner address (your MetaMask)
     * @param salt Salt for CREATE2 (use owner address for predictability)
     * @return wallet The deployed wallet address
     */
    function createWallet(
        address owner,
        bytes32 salt
    ) public returns (address wallet) {
        // Use CREATE2 for deterministic address
        bytes memory bytecode = abi.encodePacked(
            type(CustomSmartWallet).creationCode,
            abi.encode(owner, entryPoint)
        );

        assembly {
            wallet := create2(0, add(bytecode, 32), mload(bytecode), salt)
            if iszero(extcodesize(wallet)) {
                revert(0, 0)
            }
        }

        emit WalletCreated(wallet, owner, salt);
    }

    /**
     * @notice Get the counterfactual address for a wallet
     * @param owner The owner address
     * @param salt The salt
     * @return The predicted wallet address
     */
    function getAddress(
        address owner,
        bytes32 salt
    ) public view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(CustomSmartWallet).creationCode,
            abi.encode(owner, entryPoint)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );

        return address(uint160(uint256(hash)));
    }

    /**
     * @notice Get wallet address using owner as salt
     * @param owner The owner address
     * @return The predicted wallet address
     */
    function getAddressForOwner(address owner) external view returns (address) {
        return getAddress(owner, bytes32(uint256(uint160(owner))));
    }

    /**
     * @notice Create wallet using owner address as salt
     * @param owner The owner address
     * @return wallet The deployed wallet address
     */
    function createWalletForOwner(address owner) external returns (address wallet) {
        return createWallet(owner, bytes32(uint256(uint160(owner))));
    }
}
