// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title NonceManager
/// @notice The NonceManager manages nonce of smart accounts using RIP-7560.
contract NonceManager {
    /// @notice Semantic version.
    /// @custom:semver 0.1.0
    string public constant version = "0.1.0";

    /// @notice The EntryPoint address defined at RIP-7560.
    address internal constant AA_ENTRY_POINT = 0x0000000000000000000000000000000000007560;

    /// @notice There are no public functions in the NonceManager and the action is determined by the caller address.
    ///
    /// In order to query the current 'nonceSequence' of an address for a given 'nonceKey' make a view call with data:
    /// sender{20 bytes} nonceKey{32 bytes}
    ///
    /// In order to validate and increment the current 'nonceSequence' of an address AA_ENTRY_POINT calls it with data:
    /// sender{20 bytes} nonceKey{32 bytes} nonceSequence{32 bytes}
    fallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender == AA_ENTRY_POINT) {
            _validateIncrement(data);
            return new bytes(0);
        } else {
            return abi.encodePacked(_get(data));
        }
    }

    /// @notice Return the next nonce sequence for this sender.
    /// @notice Within a given key, the nonce values are sequenced.
    ///         (starting with zero, and incremented by one on each transaction).
    ///         But transactions with different keys can come with arbitrary order.
    /// @return nonceSeq a nonce sequence value to pass for next transaction with given sender and key.
    function _get(bytes calldata /* data */) internal view returns (uint256 nonceSeq) {
        assembly {
        // Check if calldata is 20+32 bytes long
            if iszero(eq(calldatasize(), 52)) {
                mstore(0x00, 0x947d5a84) // 'InvalidLength()'
                revert(0x1c, 0x04)
            }

            let ptr := mload(0x40)
            calldatacopy(ptr, 0, 52)

        // Extract sender and key from calldata
            mstore(0x00, shr(96, mload(ptr)))
            mstore(0x14, mload(add(ptr, 20)))

        // Load nonce sequence from storage
            nonceSeq := sload(keccak256(0x00, 0x34))
        }
    }

    /// @notice validate nonce key and sequence uniqueness for this account. Called by AA_ENTRY_POINT.
    function _validateIncrement(bytes calldata /* data */) internal {
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())

        // Store sender and key in memory
            mstore(0x00, shr(96, mload(ptr)))
            mstore(0x14, mload(add(ptr, 20)))

        // Calculate storage slot and load current nonce sequence
            let nonceSeqSlot := keccak256(0x00, 0x34)
            let currentNonceSeq := sload(nonceSeqSlot)

        // Revert if nonce mismatch
            if iszero(eq(mload(add(ptr, 52)), currentNonceSeq)) {
                mstore(0, 0)
                revert(0, 0) // Revert if nonce mismatch
            }

        // Increment nonce sequence
            sstore(nonceSeqSlot, add(currentNonceSeq, 1))
        }
    }
}
