import { useState, useCallback, useEffect } from 'react'
import {
    createPublicClient,
    createWalletClient,
    http,
    custom,
    zeroAddress,
    encodeFunctionData,
    parseEther
} from 'viem'
import { sepolia as chain } from 'viem/chains'
import { createBundlerClient, createPaymasterClient } from 'viem/account-abstraction'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import {
    Implementation,
    toMetaMaskSmartAccount,
    createDelegation,
    DelegationFramework,
    SINGLE_DEFAULT_MODE,
} from "@metamask/delegation-toolkit"
import { PIMLICO_API_KEY } from '../config'

// Constants
const CHAIN_ID = 11155111 // Sepolia
const TOKEN_ADDRESS = '0xa2bDc7A104d0554Ca70A28f74177501E377b1Cd8' // TEST token
const MINT_AMOUNT = parseEther('1000') // 1000 tokens for minting
const TRANSFER_AMOUNT = parseEther('10') // 10 tokens for transfer
const PERMIT_DEADLINE_HOURS = 1 // 1 hour deadline for permits

// Token ABIs
const MINT_ABI = {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
}

const TRANSFER_ABI = {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
}

const APPROVE_ABI = {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
}

const TRANSFER_FROM_ABI = {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
}

const PERMIT_ABI = {
    name: 'permit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'v', type: 'uint8' },
        { name: 'r', type: 'bytes32' },
        { name: 's', type: 'bytes32' }
    ],
    outputs: []
}

export interface Transaction {
    to: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
}

export interface UseDemoReturn {
    status: string;
    isLoading: boolean;
    // Operation details for step 4 (Mint & Transfer)
    mintTxHash: string | null;
    mintUserOpHash: string | null;
    // Operation details for step 5 (Execute Transfer)
    executeTxHash: string | null;
    executeUserOpHash: string | null;
    connectedAccount: string | null;
    delegatorSmartAccount: any | null;
    delegateSmartAccount: any | null;
    signedDelegation: any | null;
    error: string | null;
    balances: {
        eth: string;
        test: string;
        ethDiff?: number;
        testDiff?: number;
        finalBalances?: {
            eth: string;
            test: string;
        };
    } | null;
    setStatus: (status: string) => void;
    connect: () => Promise<boolean>;
    signDelegation: () => Promise<boolean>;
    mintAndTransferTokens: () => Promise<boolean>;
    approveAndTransfer: () => Promise<boolean>;
}

export function useDemo(): UseDemoReturn {
    const [status, setStatus] = useState<string>('Please connect your wallet to continue.')
    const [isLoading, setIsLoading] = useState(false)
    // Operation details for step 4 (Mint & Transfer)
    const [mintTxHash, setMintTxHash] = useState<string | null>(null)
    const [mintUserOpHash, setMintUserOpHash] = useState<string | null>(null)
    // Operation details for step 5 (Execute Transfer)
    const [executeTxHash, setExecuteTxHash] = useState<string | null>(null)
    const [executeUserOpHash, setExecuteUserOpHash] = useState<string | null>(null)
    const [connectedAccount, setConnectedAccount] = useState<string | null>(null)
    const [smartAccount, setSmartAccount] = useState<any>(null)
    const [delegatorSmartAccount, setDelegatorSmartAccount] = useState<any>(null)
    const [delegateSmartAccount, setDelegateSmartAccount] = useState<any>(null)
    const [signedDelegation, setSignedDelegation] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [balances, setBalances] = useState<UseDemoReturn['balances']>(null)

    // Initialize clients
    const publicClient = createPublicClient({
        chain,
        transport: http(),
    })

    const paymasterClient = createPaymasterClient({
        transport: http(`https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`),
    })

    const bundlerClient = createBundlerClient({
        client: publicClient,
        paymaster: paymasterClient,
        transport: http(`https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`),
    })

    const connect = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)
            
            if (!window.ethereum) {
                throw new Error('MetaMask not installed')
            }

            // Connect MetaMask
            setStatus('Connecting to MetaMask...')
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
            const account = accounts[0] as `0x${string}`
            
            // Get initial balances
            const initialBalances = await getBalances(account)
            setBalances(initialBalances)

            const walletClient = createWalletClient({
                account,
                chain,
                transport: custom(window.ethereum)
            })

            // Initialize delegator smart account
            setStatus('Creating smart account...')
            const smartAccount = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [account, [], [], []],
                deploySalt: "0x" as `0x${string}`,
                signatory: {
                    walletClient,
                    account: walletClient.account
                },
            })

            setSmartAccount(smartAccount)

            // Initialize delegate account
            setStatus('Initializing delegate account...')
            const delegatePrivateKey = generatePrivateKey()
            const delegateAccount = privateKeyToAccount(delegatePrivateKey as `0x${string}`)
            const delegateSmartAccount = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [delegateAccount.address as `0x${string}`, [], [], []],
                deploySalt: "0x" as `0x${string}`,
                signatory: { account: delegateAccount }
            })

            console.log('delegatorSmartAccount', smartAccount.address)
            console.log('delegateSmartAccount', delegateSmartAccount.address)

            const isDeployed = await publicClient.getBytecode({ address: smartAccount.address })

            if (!isDeployed) {
                console.log('Deploying delegatorSmartAccount...')
                setStatus('Deploying smart account...')

                const fees = await publicClient.estimateFeesPerGas()

                const deploymentOp = await bundlerClient.sendUserOperation({
                    account: smartAccount,
                    calls: [{
                        to: smartAccount.address,
                        data: "0x" as `0x${string}` // No-op
                    }],
                    maxFeePerGas: fees.maxFeePerGas,
                    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
                })

                console.log('Deployment User Operation:', deploymentOp)

                const receipt = await bundlerClient.waitForUserOperationReceipt({
                    hash: deploymentOp,
                    timeout: 60_000
                })
                console.log("Transaction confirmed! Receipt:", receipt)
            }

            // Set all state at once at the end
            setDelegatorSmartAccount(smartAccount)
            setDelegateSmartAccount(delegateSmartAccount)
            setConnectedAccount(account)
            setStatus('Wallet connected successfully!')
            setError(null)

            return true // Indicate successful connection

        } catch (err: any) {
            console.error('Connection error:', err)
            setError(err.message)
            setStatus('Error occurred')
            setDelegatorSmartAccount(null)
            setDelegateSmartAccount(null)
            setConnectedAccount(null)
            setBalances(null)
            return false // Indicate failed connection
        } finally {
            setIsLoading(false)
        }
    }, [publicClient, bundlerClient])

    const signDelegation = useCallback(async () => {
        if (!delegatorSmartAccount) {
            throw new Error('Please connect your wallet first')
        }

        setIsLoading(true)
        setError(null)
        setStatus('Signing delegation...')

        try {
            // Create and sign delegation
            const delegation = createDelegation({
                to: delegateSmartAccount.address,
                from: delegatorSmartAccount.address,
                caveats: []
            })

            const signature = await delegatorSmartAccount.signDelegation({
                delegation,
            })

            console.log('Delegation Signature:', signature)

            const signed = {
                ...delegation,
                signature,
            }

            // Set all state at once at the end
            setSignedDelegation(signed)
            setStatus('Delegation signed successfully!')
            setError(null)

            console.log('Signed Delegation:', signed)
            return true // Indicate successful signing

        } catch (err: any) {
            console.error('Signing error:', err)
            setError(err.message)
            setStatus('Error occurred during signing')
            setSignedDelegation(null)
            return false // Indicate failed signing
        } finally {
            setIsLoading(false)
        }
    }, [delegatorSmartAccount, delegateSmartAccount])

    const approveAndTransfer = useCallback(async () => {
        if (!signedDelegation || !delegateSmartAccount || !connectedAccount) {
            throw new Error('Please sign the delegation first')
        }

        setIsLoading(true)
        setError(null)
        setExecuteUserOpHash(null)
        setExecuteTxHash(null)
        setStatus('Preparing permit signature...')

        try {
            console.log('Starting execution with:', {
                connectedAccount,
                delegateAddress: delegateSmartAccount.address,
                delegatorAddress: delegatorSmartAccount.address,
                tokenAddress: TOKEN_ADDRESS
            })

            const amount = TRANSFER_AMOUNT // 10 tokens
            const deadline = BigInt(Math.floor(Date.now() / 1000) + PERMIT_DEADLINE_HOURS * 3600) // 1 hour from now
            console.log('Transaction parameters:', {
                amount: amount.toString(),
                deadline: deadline.toString(),
                deadlineDate: new Date(Number(deadline) * 1000).toISOString()
            })

            // Get the token contract details for permit
            console.log('Fetching token name...')
            const tokenName = await publicClient.readContract({
                address: TOKEN_ADDRESS as `0x${string}`,
                abi: [
                    {
                        name: 'name',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }
                ],
                functionName: 'name'
            })
            console.log('Token name:', tokenName)

            console.log('Fetching nonce for address:', connectedAccount)
            const nonce = await publicClient.readContract({
                address: TOKEN_ADDRESS as `0x${string}`,
                abi: [
                    {
                        name: 'nonces',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'owner', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }
                ],
                functionName: 'nonces',
                args: [connectedAccount]
            })
            console.log('Current nonce:', nonce.toString())

            // Create the permit signature
            console.log('Creating wallet client...')
            const walletClient = createWalletClient({
                account: connectedAccount as `0x${string}`,
                chain,
                transport: custom(window.ethereum)
            })

            // Get domain separator data
            const domain = {
                name: tokenName,
                version: '1',
                chainId: CHAIN_ID,
                verifyingContract: TOKEN_ADDRESS
            }
            console.log('EIP-712 Domain:', domain)

            // Define permit types
            const types = {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' }
                ]
            }
            console.log('EIP-712 Types:', types)

            const PERMIT_TRANSFER_RECIPIENT = delegatorSmartAccount.address

            // Create permit data
            const permitData = {
                owner: connectedAccount,
                spender: PERMIT_TRANSFER_RECIPIENT,
                value: amount,
                nonce: nonce,
                deadline: deadline
            }
            console.log('Permit data:', permitData)

            setStatus('Please sign the permit...')
            console.log('Requesting permit signature...')
            const signature = await walletClient.signTypedData({
                domain,
                types,
                primaryType: 'Permit',
                message: permitData
            })
            console.log('Received signature:', signature)

            // Split signature into v, r, s
            const sig = signature.slice(2)
            const r = `0x${sig.slice(0, 64)}` as `0x${string}`
            const s = `0x${sig.slice(64, 128)}` as `0x${string}`
            const v = parseInt(sig.slice(128, 130), 16)
            console.log('Split signature:', { r, s, v })

            // Encode permit call
            console.log('Encoding permit call...')
            const permitCalldata = encodeFunctionData({
                abi: [PERMIT_ABI],
                functionName: 'permit',
                args: [
                    connectedAccount,
                    PERMIT_TRANSFER_RECIPIENT,
                    amount,
                    deadline,
                    v,
                    r,
                    s
                ]
            })
            console.log('Permit calldata:', permitCalldata)

            // Encode transferFrom call
            console.log('Encoding transferFrom call...')
            const transferFromCalldata = encodeFunctionData({
                abi: [TRANSFER_FROM_ABI],
                functionName: 'transferFrom',
                args: [
                    connectedAccount,
                    PERMIT_TRANSFER_RECIPIENT as `0x${string}`,
                    amount
                ]
            })
            console.log('TransferFrom calldata:', transferFromCalldata)

            // Create execution data
            const delegations = [signedDelegation]
            const executions = [
                {
                   target: TOKEN_ADDRESS as `0x${string}`,
                    value: 0n,
                    callData: permitCalldata
                },
            ]
            console.log('Executions:', executions)

            const executions2 = [
                {
                    target: TOKEN_ADDRESS as `0x${string}`,
                    value: 0n,
                    callData: transferFromCalldata
                }
            ]

            setStatus('Preparing redemption...')
            console.log('Encoding redemption calldata...')
            const redeemDelegationCalldata = DelegationFramework.encode.redeemDelegations({
                delegations: [delegations, delegations],
                modes: [SINGLE_DEFAULT_MODE, SINGLE_DEFAULT_MODE],
                executions: [executions, executions2]
            })
            console.log('Redemption calldata:', redeemDelegationCalldata)

            // Send user operation
            setStatus('Submitting permit and transfer operation...')
            console.log('Sending user operation...')
            console.log('Estimating gas fees...')
            const fees = await publicClient.estimateFeesPerGas()
            console.log('Estimated fees:', {
                maxFeePerGas: fees.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas?.toString()
            })

            const userOperationHash = await bundlerClient.sendUserOperation({
                account: delegateSmartAccount,
                calls: [{
                    to: delegateSmartAccount.address,
                    data: redeemDelegationCalldata
                }],
                paymaster: paymasterClient,
                maxFeePerGas: fees.maxFeePerGas,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
                callGasLimit: 2_500_000n,
                verificationGasLimit: 1_500_000n,
                preVerificationGas: 1_000_000n,
            })

            console.log('User Operation Hash:', userOperationHash)
            setExecuteUserOpHash(userOperationHash)
            setStatus(`Permit and transfer operation submitted! Hash: ${userOperationHash}`)

            // Wait for transaction confirmation
            setStatus('Waiting for permit and transfer confirmation...')
            const receipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOperationHash,
                timeout: 60_000
            })

            console.log('Transaction Receipt:', receipt)
            console.log('Transaction details:', {
                transactionHash: receipt.receipt.transactionHash,
                blockNumber: receipt.receipt.blockNumber,
                gasUsed: receipt.receipt.gasUsed?.toString()
            })

            setExecuteTxHash(receipt.receipt.transactionHash)
            setStatus(`Permit and transfer operation confirmed! Hash: ${receipt.receipt.transactionHash}`)
            return true

        } catch (err: any) {
            console.error('Execution error:', err)
            console.error('Error details:', {
                message: err.message,
                code: err.code,
                data: err.data,
                stack: err.stack
            })
            setError(err.message)
            setStatus('Error occurred during transfer execution')
            setExecuteTxHash(null)
            setExecuteUserOpHash(null)
            return false
        } finally {
            setIsLoading(false)
        }
    }, [signedDelegation, delegateSmartAccount, delegatorSmartAccount, connectedAccount, publicClient, bundlerClient, paymasterClient])

    // Add useEffect for balance updates
    useEffect(() => {
        const updateBalances = async () => {
            if (connectedAccount) {
                const newBalances = await getBalances(connectedAccount)
                setBalances(newBalances)
            }
        }

        updateBalances()
        
        // Set up interval to update balances
        const interval = setInterval(updateBalances, 5000)
        return () => clearInterval(interval)
    }, [connectedAccount])

    const getBalances = async (address: string) => {
        try {
            console.log('Fetching balances for address:', address)

            if (!address || !address.startsWith('0x')) {
                console.error('Invalid address:', address)
                return { eth: '0', test: '0' }
            }

            // Get ETH balance using viem
            console.log('Fetching ETH balance...')
            const ethBalance = await publicClient.getBalance({ 
                address: address as `0x${string}`
            }).catch(err => {
                console.error('Error fetching ETH balance:', err)
                return 0n
            })
            console.log('Raw ETH balance:', ethBalance.toString())
            
            // Get TEST token balance using viem
            console.log('Fetching TEST token balance for:', {
                tokenAddress: TOKEN_ADDRESS,
                userAddress: address,
                chainId: publicClient.chain.id
            })

            // First check if the token contract exists
            const code = await publicClient.getBytecode({
                address: TOKEN_ADDRESS as `0x${string}`
            })
            
            if (!code) {
                console.error('Token contract not deployed at address:', TOKEN_ADDRESS)
                return { eth: formatBalance(ethBalance.toString()), test: '0.0000' }
            }

            const tokenBalance = await publicClient.readContract({
                address: TOKEN_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }]
                }],
                functionName: 'balanceOf',
                args: [address]
            }).catch(err => {
                console.error('Error fetching TEST balance:', err)
                return 0n
            })
            console.log('Raw TEST balance:', tokenBalance.toString())

            // Format balances
            const formattedEth = formatBalance(ethBalance.toString())
            const formattedTest = formatBalance(tokenBalance.toString())
            
            console.log('Formatted balances:', {
                eth: formattedEth,
                test: formattedTest,
                address,
                tokenAddress: TOKEN_ADDRESS,
                publicClientChainId: publicClient.chain.id,
                hasCode: !!code
            })

            return {
                eth: formattedEth,
                test: formattedTest
            }
        } catch (err) {
            const error = err as Error
            console.error('Error fetching balances:', error)
            console.error('Error details:', {
                message: error.message,
                code: (error as any).code,
                data: (error as any).data,
                stack: error.stack
            })
            return { eth: '0', test: '0' }
        }
    }

    const formatBalance = (balance: string) => {
        console.log('Formatting balance:', balance)
        if (!balance || balance === '0' || balance === '0x0') {
            console.log('Empty or zero balance, returning 0.0000')
            return '0.0000'
        }
        const formatted = (Number(balance) / 1e18).toFixed(4)
        console.log('Formatted result:', formatted)
        return formatted
    }

    const mintAndTransferTokens = useCallback(async () => {
        if (!delegateSmartAccount || !connectedAccount) {
            throw new Error('Delegate account or connected account not available')
        }

        try {
            setIsLoading(true)
            setError(null)
            setMintUserOpHash(null)
            setMintTxHash(null)

            // Get initial balances silently
            const initialBalances = await getBalances(connectedAccount)
            setBalances(initialBalances)

            const amount = MINT_AMOUNT // Mint 1000 tokens
            console.log('Minting amount:', amount.toString())

            // Encode mint call
            setStatus('Preparing token operations...')
            const mintCalldata = encodeFunctionData({
                abi: [MINT_ABI],
                functionName: 'mint',
                args: [delegatorSmartAccount.address, amount]
            })
            console.log('Mint calldata:', mintCalldata)

            // Encode transfer call
            const transferCalldata = encodeFunctionData({
                abi: [TRANSFER_ABI],
                functionName: 'transfer',
                args: [connectedAccount, amount]
            })
            console.log('Transfer calldata:', transferCalldata)

            console.log('Estimating gas fees...')
            const fees = await publicClient.estimateFeesPerGas()
            console.log('Estimated fees:', {
                maxFeePerGas: fees.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas?.toString()
            })

            // Create execution data
            const delegations = [signedDelegation]

            const executions0 = [
                {
                    target: zeroAddress,  
                    value: 0n, 
                    callData: "0x" as `0x${string}`
                  }
            ]

            console.log('executions0', executions0)

            const executions = [
                {
                    target: TOKEN_ADDRESS as `0x${string}`,
                    value: 0n,
                    callData: mintCalldata
                }
            ]

            const executions2 = [
                {
                    target: TOKEN_ADDRESS as `0x${string}`,
                    value: 0n,
                    callData: transferCalldata
                }
            ]

            console.log('Creating redemption calldata...')
            const redeemDelegationCalldata = DelegationFramework.encode.redeemDelegations({
                delegations: [delegations, delegations, delegations],
                modes: [SINGLE_DEFAULT_MODE, SINGLE_DEFAULT_MODE, SINGLE_DEFAULT_MODE],
                executions: [executions0, executions, executions2]
            })
            console.log('Redemption calldata:', redeemDelegationCalldata)

            // Send user operation
            setStatus('Submitting mint and transfer operation...')
            console.log('Sending user operation with params:', {
                account: delegateSmartAccount.address,
                to: delegateSmartAccount.address,
                data: redeemDelegationCalldata
            })

            const userOpHash = await bundlerClient.sendUserOperation({
                account: delegateSmartAccount,
                calls: [{
                    to: delegateSmartAccount.address,
                    data: redeemDelegationCalldata
                }],
                paymaster: paymasterClient,
                maxFeePerGas: fees.maxFeePerGas,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
                callGasLimit: 2_500_000n,
                verificationGasLimit: 1_500_000n,
                preVerificationGas: 1_000_000n,
            })

            console.log('Token Operations User Operation Hash:', userOpHash)
            setMintUserOpHash(userOpHash)
            setStatus(`Mint and transfer operation submitted! Hash: ${userOpHash}`)

            // Wait for transaction confirmation
            setStatus('Waiting for mint and transfer confirmation...')
            console.log('Waiting for user operation receipt...')
            const receipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
                timeout: 60_000
            })

            console.log('Token Operations Receipt:', receipt)
            console.log('Transaction details:', {
                transactionHash: receipt.receipt.transactionHash,
                blockNumber: receipt.receipt.blockNumber,
                gasUsed: receipt.receipt.gasUsed?.toString()
            })

            setMintTxHash(receipt.receipt.transactionHash)
            setStatus(`Mint and transfer operation confirmed! Hash: ${receipt.receipt.transactionHash}`)

            // Wait a bit for state to update
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            const finalBalances = await getBalances(connectedAccount)
            const ethDiff = Number(finalBalances.eth) - Number(initialBalances.eth)
            const testDiff = Number(finalBalances.test) - Number(initialBalances.test)
            
            console.log('Balance changes:', {
                eth: ethDiff,
                test: testDiff,
                initial: initialBalances,
                final: finalBalances
            })

            setBalances({
                ...finalBalances,
                ethDiff,
                testDiff,
                finalBalances
            })

            return true

        } catch (error: any) {
            console.error('Token operation failed:', error)
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                data: error.data,
                stack: error.stack
            })
            setError(error.message)
            setStatus('Failed to execute mint operations')
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [delegateSmartAccount, connectedAccount, delegatorSmartAccount, signedDelegation, publicClient, bundlerClient, paymasterClient])

    return {
        status,
        isLoading,
        mintTxHash,
        mintUserOpHash,
        executeTxHash,
        executeUserOpHash,
        connectedAccount,
        delegatorSmartAccount,
        delegateSmartAccount,
        signedDelegation,
        error,
        balances,
        setStatus,
        connect,
        signDelegation,
        mintAndTransferTokens,
        approveAndTransfer
    }
} 