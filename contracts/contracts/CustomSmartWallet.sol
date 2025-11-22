// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title CustomSmartWallet
 * @notice ERC-4337 compliant smart wallet with batch transaction support
 * @dev Controlled by an ECDSA owner (your MetaMask wallet)
 */
contract CustomSmartWallet {
    // ERC-4337 EntryPoint
    address public immutable entryPoint;

    // Owner of this wallet (your MetaMask address)
    address public owner;

    // Nonce for replay protection
    uint256 private _nonce;

    // Struct for batch calls
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    // Events
    event WalletInitialized(address indexed owner, address indexed entryPoint);
    event BatchExecuted(uint256 indexed batchId, uint256 callsCount);
    event Executed(address indexed target, uint256 value, bytes data);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Errors
    error NotAuthorized();
    error InvalidEntryPoint();
    error CallFailed();
    error InvalidArrayLength();

    // Modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert InvalidEntryPoint();
        _;
    }

    modifier onlyOwnerOrEntryPoint() {
        if (msg.sender != owner && msg.sender != entryPoint) {
            revert NotAuthorized();
        }
        _;
    }

    /**
     * @notice Initialize the wallet
     * @param _owner The owner address (your MetaMask)
     * @param _entryPoint The ERC-4337 EntryPoint address
     */
    constructor(address _owner, address _entryPoint) {
        require(_owner != address(0), "Invalid owner");
        require(_entryPoint != address(0), "Invalid entryPoint");

        owner = _owner;
        entryPoint = _entryPoint;

        emit WalletInitialized(_owner, _entryPoint);
    }

    /**
     * @notice Validate user operation signature (ERC-4337)
     * @dev Called by EntryPoint to validate the UserOperation
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        // Verify signature is from owner
        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        address signer = ECDSA.recover(hash, userOp.signature);

        if (signer != owner) {
            return 1; // SIG_VALIDATION_FAILED
        }

        // Pay the EntryPoint if needed
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "Payment failed");
        }

        return 0; // Signature valid
    }

    /**
     * @notice Execute a single transaction
     * @param target The target contract address
     * @param value The ETH value to send
     * @param data The calldata
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwnerOrEntryPoint {
        _call(target, value, data);
        emit Executed(target, value, data);
    }

    /**
     * @notice Execute multiple transactions in a batch
     * @param calls Array of calls to execute
     */
    function executeBatch(Call[] calldata calls) external onlyOwnerOrEntryPoint {
        uint256 batchId = _nonce++;

        for (uint256 i = 0; i < calls.length; i++) {
            _call(calls[i].target, calls[i].value, calls[i].data);
        }

        emit BatchExecuted(batchId, calls.length);
    }

    /**
     * @notice Internal function to execute a call
     * @param target The target address
     * @param value The ETH value
     * @param data The calldata
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            // Bubble up the revert reason
            if (result.length > 0) {
                assembly {
                    let size := mload(result)
                    revert(add(32, result), size)
                }
            } else {
                revert CallFailed();
            }
        }
    }

    /**
     * @notice Transfer ownership to a new address
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @notice Get the current nonce
     */
    function getNonce() external view returns (uint256) {
        return _nonce;
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}

    /**
     * @notice Fallback function
     */
    fallback() external payable {}
}

// UserOperation struct for ERC-4337
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

// Helper library for ECDSA signature verification
library ECDSA {
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            return address(0);
        }

        return ecrecover(hash, v, r, s);
    }
}
