import { useState, useCallback } from 'react'
import {
    createPublicClient,
    createWalletClient,
    http,
    custom,
    encodeFunctionData,
    parseEther
} from 'viem'
import { sepolia as chain } from 'viem/chains'
import { createBundlerClient, createPaymasterClient } from 'viem/account-abstraction'
import {
    Implementation,
    toMetaMaskSmartAccount,
} from "@metamask/delegation-toolkit"
import { PIMLICO_API_KEY } from '../config'

// Constants
const CHAIN_ID = 11155111 // Sepolia
const TOKEN_ADDRESS = '0xa2bDc7A104d0554Ca70A28f74177501E377b1Cd8' // TEST token
const USDC_TOKEN_ADDRESS = '0xbcbe9513296Ca521E5f4A25cC1C2594C6B48362a' // UDSC test token
const BASIC_SWAP_ADDRESS = '0xAA3df3c86EdB6aA4D03b75092b4dd0b99515EC83' // BasicSwap test contract
const MINT_AMOUNT = parseEther('1000') // 1000 tokens for minting

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

const SWAP_ABI = {
    name: 'swap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: '_inputToken', type: 'address' },
        { name: '_inputAmount', type: 'uint256' }
    ],
    outputs: []
}

export interface UseDemoReturn {
    status: string;
    isLoading: boolean;
    mintTxHash: string | null;
    mintUserOpHash: string | null;
    swapTxHash: string | null;
    swapUserOpHash: string | null;
    connectedAccount: string | null;
    delegatorSmartAccount: any | null;
    error: string | null;
    balances: {
        eth: string;
        test: string;
        usdc: string;
        ethDiff?: number;
        testDiff?: number;
        usdcDiff?: number;
        finalBalances?: {
            eth: string;
            test: string;
            usdc: string;
        };
    } | null;
    setStatus: (status: string) => void;
    connect: () => Promise<boolean>;
    mintAndTransferTokens: () => Promise<boolean>;
    transferAndSwapTokens: () => Promise<boolean>;
}

export function useDemo(): UseDemoReturn {
    const [status, setStatus] = useState<string>('Please connect your wallet to continue.')
    const [isLoading, setIsLoading] = useState(false)
    const [mintTxHash, setMintTxHash] = useState<string | null>(null)
    const [mintUserOpHash, setMintUserOpHash] = useState<string | null>(null)
    const [swapTxHash, setSwapTxHash] = useState<string | null>(null)
    const [swapUserOpHash, setSwapUserOpHash] = useState<string | null>(null)
    const [connectedAccount, setConnectedAccount] = useState<string | null>(null)
    const [delegatorSmartAccount, setDelegatorSmartAccount] = useState<any>(null)
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

            const _walletClient = createWalletClient({
                account,
                chain,
                transport: custom(window.ethereum)
            })

            // Initialize delegator smart account
            setStatus('Creating smart account...')
            const delegatorSmartAccount = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [account, [], [], []],
                deploySalt: "0x22" as `0x${string}`,
                signatory: {
                    walletClient: _walletClient,
                    account: _walletClient.account
                },
            })

            console.log('delegatorSmartAccount', delegatorSmartAccount.address)

            setDelegatorSmartAccount(delegatorSmartAccount)
            setConnectedAccount(account)
            setStatus('Wallet connected successfully!')
            setError(null)

            return true

        } catch (err: any) {
            console.error('Connection error:', err)
            setError(err.message)
            setStatus('Error occurred')
            setDelegatorSmartAccount(null)
            setConnectedAccount(null)
            setBalances(null)
            return false
        } finally {
            setIsLoading(false)
        }
    }, [publicClient])

    const getBalances = async (address: string) => {
        try {
            if (!address || !address.startsWith('0x')) {
                return { eth: '0', test: '0', usdc: '0' }
            }

            // Get ETH balance
            const ethBalance = await publicClient.getBalance({ 
                address: address as `0x${string}`
            }).catch(() => 0n)
            
            // Get TEST token balance
            const testBalance = await publicClient.readContract({
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
            }).catch(() => 0n)

            // Get USDC balance
            const usdcBalance = await publicClient.readContract({
                address: USDC_TOKEN_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }]
                }],
                functionName: 'balanceOf',
                args: [address]
            }).catch(() => 0n)

            return {
                eth: formatBalance(ethBalance.toString()),
                test: formatBalance(testBalance.toString()),
                usdc: formatBalance(usdcBalance.toString())
            }
        } catch (err) {
            console.error('Error fetching balances:', err)
            return { eth: '0', test: '0', usdc: '0' }
        }
    }

    const formatBalance = (balance: string) => {
        if (!balance || balance === '0' || balance === '0x0') {
            return '0.0000'
        }
        return (Number(balance) / 1e18).toFixed(4)
    }

    const mintAndTransferTokens = useCallback(async () => {
        if (!delegatorSmartAccount || !connectedAccount) {
            throw new Error('Delegator smart account or connected account not available')
        }

        try {
            setIsLoading(true)
            setError(null)
            setMintUserOpHash(null)
            setMintTxHash(null)

            // Get initial balances silently
            const initialBalances = await getBalances(connectedAccount)
            setBalances(initialBalances)

            const amount = MINT_AMOUNT
            console.log('Minting amount:', amount.toString())

            // Encode mint call
            setStatus('Preparing token operations...')
            const mintCalldata = encodeFunctionData({
                abi: [MINT_ABI],
                functionName: 'mint',
                args: [delegatorSmartAccount.address, amount]
            })

            // Encode transfer call
            const transferCalldata = encodeFunctionData({
                abi: [TRANSFER_ABI],
                functionName: 'transfer',
                args: [connectedAccount, amount]
            })

            console.log('Estimating gas fees...')
            const fees = await publicClient.estimateFeesPerGas()

            // Send user operation
            setStatus('Submitting mint and transfer operation...')
            const userOpHash = await bundlerClient.sendUserOperation({
                account: delegatorSmartAccount,
                calls: [
                    {
                        to: TOKEN_ADDRESS,
                        data: mintCalldata,
                    },
                    {
                        to: TOKEN_ADDRESS,
                        data: transferCalldata,
                    }
                ],
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
            const receipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
                timeout: 60_000
            })

            setMintTxHash(receipt.receipt.transactionHash)
            setStatus(`Mint and transfer operation confirmed! Hash: ${receipt.receipt.transactionHash}`)

            // Wait a bit for state to update
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            const finalBalances = await getBalances(connectedAccount)
            const ethDiff = Number(finalBalances.eth) - Number(initialBalances.eth)
            const testDiff = Number(finalBalances.test) - Number(initialBalances.test)
            
            setBalances({
                ...finalBalances,
                ethDiff,
                testDiff,
                finalBalances
            })

            return true

        } catch (error: any) {
            console.error('Token operation failed:', error)
            setError(error.message)
            setStatus('Failed to execute mint operations')
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [connectedAccount, delegatorSmartAccount, publicClient, bundlerClient, paymasterClient])

    const transferAndSwapTokens = useCallback(async () => {
        if (!delegatorSmartAccount || !connectedAccount) {
            throw new Error('Delegator smart account or connected account not available')
        }

        try {
            setIsLoading(true)
            setError(null)
            setSwapUserOpHash(null)
            setSwapTxHash(null)

            // Get initial balances silently
            const initialBalances = await getBalances(connectedAccount)
            setBalances(initialBalances)

            // Check TEST token balance of connected account
            const testBalance = await publicClient.readContract({
                address: TOKEN_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }]
                }],
                functionName: 'balanceOf',
                args: [connectedAccount]
            })

            const swapAmount = parseEther('10')
            console.log('Current TEST balance of connected account:', testBalance.toString())
            console.log('Attempting to swap amount:', swapAmount.toString())

            // Get permit signature from connected account
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour from now
            const nonce = await publicClient.readContract({
                address: TOKEN_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'nonces',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'owner', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }]
                }],
                functionName: 'nonces',
                args: [connectedAccount]
            })

            const domain = {
                name: 'Test Token',
                version: '1',
                chainId: CHAIN_ID,
                verifyingContract: TOKEN_ADDRESS
            }

            const types = {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' }
                ]
            }

            // Create permit data
            const permitData = {
                owner: connectedAccount,
                spender: delegatorSmartAccount.address,
                value: swapAmount,
                nonce: nonce,
                deadline: deadline
            }

            const walletClient = createWalletClient({
                account: connectedAccount,
                chain,
                transport: custom(window.ethereum)
            })

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
            const permitCalldata = encodeFunctionData({
                abi: [PERMIT_ABI],
                functionName: 'permit',
                args: [connectedAccount, delegatorSmartAccount.address, swapAmount, deadline, v, r as `0x${string}`, s as `0x${string}`]
            })

            const transferFromCalldata = encodeFunctionData({
                abi: [TRANSFER_FROM_ABI],
                functionName: 'transferFrom',
                args: [connectedAccount, delegatorSmartAccount.address, swapAmount]
            })

            // Then approve BasicSwap to spend tokens
            const approveSwapCalldata = encodeFunctionData({
                abi: [APPROVE_ABI],
                functionName: 'approve',
                args: [BASIC_SWAP_ADDRESS, swapAmount]
            })

            // Execute the swap
            const swapCalldata = encodeFunctionData({
                abi: [SWAP_ABI],
                functionName: 'swap',
                args: [TOKEN_ADDRESS, swapAmount]
            })

            // Transfer resulting USDC back to user
            const transferUSDCCalldata = encodeFunctionData({
                abi: [TRANSFER_ABI],
                functionName: 'transfer',
                args: [connectedAccount, parseEther('9.9')] // 99% of 10 tokens due to swap rate
            })

            console.log('Estimating gas fees...')
            const fees = await publicClient.estimateFeesPerGas()

            setStatus('Submitting swap operation...')
            const userOpHash = await bundlerClient.sendUserOperation({
                account: delegatorSmartAccount,
                calls: [
                    {
                        to: TOKEN_ADDRESS,
                        data: permitCalldata,
                    },
                    {
                        to: TOKEN_ADDRESS,
                        data: transferFromCalldata,
                    },
                    {
                        to: TOKEN_ADDRESS,
                        data: approveSwapCalldata,  // Approve BasicSwap to spend tokens
                    },
                    {
                        to: BASIC_SWAP_ADDRESS,
                        data: swapCalldata,  // Perform the swap
                    },
                    {
                        to: USDC_TOKEN_ADDRESS,
                        data: transferUSDCCalldata,  // Transfer USDC back to user
                    }
                ],
                paymaster: paymasterClient,
                maxFeePerGas: fees.maxFeePerGas,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
                callGasLimit: 2_500_000n,
                verificationGasLimit: 1_500_000n,
                preVerificationGas: 1_000_000n,
            })

            console.log('Swap Operation Hash:', userOpHash)
            setSwapUserOpHash(userOpHash)
            setStatus(`Swap operation submitted! Hash: ${userOpHash}`)

            // Wait for transaction confirmation
            setStatus('Waiting for swap confirmation...')
            const receipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
                timeout: 60_000
            })

            setSwapTxHash(receipt.receipt.transactionHash)
            setStatus(`Swap operation confirmed! Hash: ${receipt.receipt.transactionHash}`)

            // Wait a bit for state to update
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            const finalBalances = await getBalances(connectedAccount)
            const ethDiff = Number(finalBalances.eth) - Number(initialBalances.eth)
            const testDiff = Number(finalBalances.test) - Number(initialBalances.test)
            const usdcDiff = Number(finalBalances.usdc) - Number(initialBalances.usdc)
            
            setBalances({
                ...finalBalances,
                ethDiff,
                testDiff,
                usdcDiff,
                finalBalances
            })

            return true

        } catch (error: any) {
            console.error('Swap operation failed:', error)
            setError(error.message)
            setStatus('Failed to execute swap operations')
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [connectedAccount, delegatorSmartAccount, publicClient, bundlerClient, paymasterClient])

    return {
        status,
        isLoading,
        mintTxHash,
        mintUserOpHash,
        swapTxHash,
        swapUserOpHash,
        connectedAccount,
        delegatorSmartAccount,
        error,
        balances,
        setStatus,
        connect,
        mintAndTransferTokens,
        transferAndSwapTokens
    }
} 