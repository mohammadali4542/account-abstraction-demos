import React, { useState, useEffect, useCallback } from 'react'
import {
    Box,
    Button,
    Typography,
    Paper,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Link,
    CircularProgress,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    TextField,
    Slider,
    Tooltip,
    LinearProgress
} from '@mui/material'
import { createWalletClient, custom, createPublicClient, http, formatEther, parseEther, encodeFunctionData, concat, keccak256, pad } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { createBundlerClient, createPaymasterClient } from "viem/account-abstraction"
import { erc7715ProviderActions } from "@metamask/delegation-toolkit/experimental"
import { toMetaMaskSmartAccount, Implementation } from "@metamask/delegation-toolkit"
import { erc7710BundlerActions } from "@metamask/delegation-toolkit/experimental"
import { PIMLICO_API_KEY } from '../config'


async function computeDelegationManagerAddress() {
    // Constants from the events
    const FACTORY_ADDRESS = '0x69aa2f9fe1572f1b640e1bbc512f5c3a734fc77c'
    const IMPLEMENTATION_ADDRESS = '0x48dBe696A4D990079e039489bA2053B36E8FFEC4'
    const SALT = '0x0000000000000000000000000000000000000000000000000000000000000000'
  
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http()
    })
  
    // From the events we can see this sequence:
    // 1. Factory deploys contract
    // 2. Contract is upgraded to 0x56a9EdB16a0105eb5a4C54f4C062e2868844f3A7
    // 3. Signer 0x72bB3CA6F6F35e750739396e861e24deBAd7Ca15 is added
    // 4. Threshold set to 1
    // 5. Contract initialized
  
    // Let's get the factory's deployment code
    const factoryABI = [{
      inputs: [
        { name: '_bytecode', type: 'bytes' },
        { name: '_salt', type: 'bytes32' }
      ],
      name: 'deploy',
      outputs: [{ name: 'addr_', type: 'address' }],
      stateMutability: 'nonpayable',
      type: 'function'
    }]
  
    // Get the implementation bytecode
    const implementationBytecode = await publicClient.getBytecode({
      address: IMPLEMENTATION_ADDRESS
    })
  
    // The factory's deploy function takes bytecode and salt
    const factoryDeployData = encodeFunctionData({
      abi: factoryABI,
      functionName: 'deploy',
      args: [
        implementationBytecode,
        SALT
      ]
    })
  
    // Compute CREATE2 address using the factory's logic
    function computeCreate2Address(bytecode: `0x${string}` | ByteArray, salt: `0x${string}` | ByteArray) {
      const initCodeHash = keccak256(bytecode)
      const prefix = '0xff' as `0x${string}`
      const packedData = concat([
        prefix,
        pad(FACTORY_ADDRESS, { size: 32 }),
        pad(salt, { size: 32 }),
        initCodeHash
      ])
      return `0x${keccak256(packedData).slice(26)}`
    }
  
    // Add type check for implementationBytecode
    if (!implementationBytecode) {
        throw new Error('Implementation bytecode is undefined')
    }
  
    const computedAddress = computeCreate2Address(implementationBytecode, SALT)
  
    console.log('Computed address:', computedAddress)
    console.log('Expected address: 0xeca727f485d12fc0eb2602e72a88b5e71ef1168d')
  
    // Let's also log the components for verification
    console.log('Components used:')
    console.log('Factory:', FACTORY_ADDRESS)
    console.log('Implementation:', IMPLEMENTATION_ADDRESS)
    console.log('Salt:', SALT)
    console.log('Implementation bytecode length:', implementationBytecode.length)
  }
// computeDelegationManagerAddress().catch(console.error)

// Constants
const CHAIN_ID = 11155111 // Sepolia

// Initialize clients
const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
})

const paymasterClient = createPaymasterClient({
    transport: http(`https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`),
})

const bundlerClient = createBundlerClient({
    client: publicClient,
    paymaster: paymasterClient,
    transport: http(`https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`),
}).extend(erc7710BundlerActions())

// Define step information
const STEPS = [
    {
        label: 'Connect Wallet',
        description: 'Connect your MetaMask wallet to get started.',
        details: [
            'This step connects your MetaMask wallet to the application.',
            'Make sure you are using MetaMask Flask 12.14.2 or later.',
            'The demo will create a session account for permissions.'
        ]
    },
    {
        label: 'Select Network',
        description: 'Choose the network you want to operate on.',
        details: [
            'Select the blockchain network where you want to execute the delegation.',
            'Currently supporting Sepolia testnet.',
            'All transactions are gasless - no transaction fees required.'
        ]
    },
    {
        label: 'Request Stream Permission',
        description: 'Request permission for native token streaming.',
        details: [
            'This step requests permission to stream native tokens (ETH).',
            'You can specify the stream parameters like rate and duration.',
            'The permission will be granted through ERC-7715.',
            'This is a gasless signature - no transaction fees required.'
        ]
    },
    {
        label: 'Execute Stream',
        description: 'Execute the token stream using the granted permission.',
        details: [
            'This step executes the token stream using the granted permission.',
            'The stream will transfer tokens according to the specified parameters.',
            'The execution uses ERC-7710 for delegation.',
            'You can monitor the stream progress in real-time.'
        ]
    },
    {
        label: 'Pull Stream',
        description: 'Pull more ETH from the active stream.',
        details: [
            'This step allows you to pull additional ETH from the active stream.',
            'You can specify the amount to pull based on the available stream balance.',
            'The pull request uses the same permission granted earlier.',
            'Each pull creates a new transaction on the blockchain.'
        ]
    },
    {
        label: 'Send Funds',
        description: 'Send pulled ETH to your MetaMask account.',
        details: [
            'This final step helps clean up and finalize the demo.',
            'Any remaining ETH in the session account will be sent back to your MetaMask account.',
            'This ensures no funds are left behind in the temporary session account.',
            'After this step, you can safely end the demo session.'
        ]
    }
]

export function Demo() {
    const [connectedAccount, setConnectedAccount] = useState<`0x${string}` | null>(null)
    const [walletClient, setWalletClient] = useState<any>(null)
    const [sessionAccount, setSessionAccount] = useState<any>(null)
    const [sessionKey, setSessionKey] = useState<string | null>(null)
    const [activeStep, setActiveStep] = useState(0)
    const [selectedNetwork, setSelectedNetwork] = useState<`0x${string}`>("0xaa36a7") // Sepolia
    const [isLoading, setIsLoading] = useState(false)
    const [status, setStatus] = useState('Please connect your wallet to continue.')
    const [error, setError] = useState('')
    const [stepCompleted, setStepCompleted] = useState(false)
    const [balances, setBalances] = useState<{
        user: string;
        session: string;
        gator: string;
    }>({
        user: '0',
        session: '0',
        gator: '0'
    })
    const [userOpHash, setUserOpHash] = useState<string | null>(null)
    const [receipt, setReceipt] = useState<any>(null)
    const [permissionResponse, setPermissionResponse] = useState<any>(null)
    const [executedSteps, setExecutedSteps] = useState<{[key: number]: boolean}>({})

    // Stream timeline
    const [streamTimeline, setStreamTimeline] = useState<{
        startTime: number;
        endTime: number;
        currentAmount: string;
        progress: number;
    }>({
        startTime: Math.floor(Date.now() / 1000) - (24 * 60 * 60),
        endTime: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
        currentAmount: '0',
        progress: 0
    })

    // Stream parameters
    const [streamParams, setStreamParams] = useState({
        initialAmount: '0.00001', // Initial amount in ETH
        amountPerSecond: '0.00001', // ETH per second
        duration: (60 * 60 * 24).toString(), // 1 day in seconds
        maxAmount: '0.001', // Max amount in ETH
    })

    // Pull stream state
    const [pullAmount, setPullAmount] = useState('0.001')
    const [availableAmount, setAvailableAmount] = useState('0')
    const [totalPulled, setTotalPulled] = useState('0')

    // Add network state tracking at the top with other state variables
    const [currentNetwork, setCurrentNetwork] = useState<string | null>(null)

    // Add network check to the useEffect that runs when component mounts
    useEffect(() => {
        const checkNetwork = async () => {
            try {
                const chainId = await window.ethereum.request({ method: 'eth_chainId' })
                setCurrentNetwork(chainId)
            } catch (err) {
                console.error('Failed to get network:', err)
            }
        }
        
        if (window.ethereum) {
            checkNetwork()
            
            // Listen for network changes
            window.ethereum.on('chainChanged', (chainId: string) => {
                setCurrentNetwork(chainId)
            })
        }
    }, [])

    // Load session account and permission from local storage
    useEffect(() => {
        const storedKey = localStorage.getItem('sessionKey')
        const storedPermissionData = localStorage.getItem('streamPermission')
        const storedTotalPulled = localStorage.getItem('totalPulled')
        const storedExecutedSteps = localStorage.getItem('executedSteps')
        
        if (storedKey) {
            setSessionKey(storedKey)
        }
        if (storedPermissionData) {
            try {
                const parsedData = JSON.parse(storedPermissionData)
                setPermissionResponse(parsedData.permission)
                
                // If we have a gator address and publicClient, get its balance
                if (parsedData.gatorAddress && publicClient) {
                    publicClient.getBalance({
                        address: parsedData.gatorAddress
                    }).then(balance => {
                        setBalances(prev => ({
                            ...prev,
                            gator: formatEther(balance)
                        }))
                    }).catch(console.error)
                }
            } catch (err) {
                console.error('Failed to parse stored permission:', err)
            }
        }
        if (storedTotalPulled) {
            setTotalPulled(storedTotalPulled)
        }
        if (storedExecutedSteps) {
            try {
                setExecutedSteps(JSON.parse(storedExecutedSteps))
            } catch (err) {
                console.error('Failed to parse stored executed steps:', err)
            }
        }
    }, [publicClient])

    // Initialize session account when key is available
    useEffect(() => {
        const initializeSessionAccount = async () => {
            if (sessionKey && publicClient) {
                const account = privateKeyToAccount(sessionKey as `0x${string}`)
                const session = await toMetaMaskSmartAccount({
                    client: publicClient,
                    implementation: Implementation.Hybrid,
                    deployParams: [account.address as `0x${string}`, [], [], []],
                    deploySalt: "0x",
                    signatory: { account },
                })
                console.log('MetaMask Smart Account Address:', session.address)
                console.log('Signatory EOA Address:', account.address)
                setSessionAccount(session)
            }


            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
            console.log('accounts', accounts)
            const connectedAddress = accounts[0]
            const _walletClient = createWalletClient({
                account: connectedAddress,
                chain: sepolia,
                transport: custom(window.ethereum)
            })
   
            const session1 = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [connectedAddress as `0x${string}`, [], [], []],
                deploySalt: "0x0000000000000000000000000000000000000000000000000000000000000000",
                signatory: {
                    walletClient: _walletClient,
                    account: _walletClient.account
                 },
            })
            console.log('addressss', session1.address)
        }

        initializeSessionAccount()
    }, [sessionKey, publicClient])

    // Calculate available stream amount
    const calculateAvailableAmount = useCallback(() => {
        if (!streamTimeline.startTime || !permissionResponse?.[0]?.permission?.data) return '0'

        const currentTime = Math.floor(Date.now() / 1000)
        const elapsed = currentTime - streamTimeline.startTime
        const amountPerSecond = parseFloat(formatEther(BigInt(permissionResponse[0].permission.data.amountPerSecond)))
        const maxAmount = parseFloat(formatEther(BigInt(permissionResponse[0].permission.data.maxAmount)))
        const initialAmount = parseFloat(formatEther(BigInt(permissionResponse[0].permission.data.initialAmount)))
        const gatorBalance = parseFloat(balances.gator)
        
        // Calculate streamed amount
        const streamedAmount = elapsed * amountPerSecond
        // Add initial amount
        const totalAmount = streamedAmount + initialAmount
        // Cap at max amount
        const availableAmount = Math.min(totalAmount, maxAmount)
        // Subtract amount already pulled
        const remainingAmount = Math.max(availableAmount - parseFloat(totalPulled), 0)
        // Cap at gator balance - this is a hard limit
        const finalAmount = Math.min(remainingAmount, gatorBalance)

        console.log('Stream calculation:', {
            currentTime,
            startTime: streamTimeline.startTime,
            elapsed,
            amountPerSecond,
            streamedAmount,
            initialAmount,
            totalAmount,
            maxAmount,
            availableAmount,
            totalPulled,
            remainingAmount,
            gatorBalance,
            finalAmount
        })
        
        // If there's no balance in the gator account, return 0
        if (gatorBalance <= 0) return '0'
        
        return finalAmount.toString()
    }, [streamTimeline.startTime, permissionResponse, totalPulled, balances.gator])

    // Update available amount periodically
    useEffect(() => {
        if (activeStep === 4) {
            const updateAvailable = () => {
                setAvailableAmount(calculateAvailableAmount())
            }
            updateAvailable()
            const interval = setInterval(updateAvailable, 1000)
            return () => clearInterval(interval)
        }
    }, [activeStep, calculateAvailableAmount])

    // Reset stepCompleted when moving to a new step
    useEffect(() => {
        setStepCompleted(false)
        setStatus('') // Clear status message
        setUserOpHash(null) // Clear transaction hash
        setReceipt(null) // Clear transaction receipt
        setError('') // Clear any error messages
        
        // Set initial status message based on the step
        switch (activeStep) {
            case 0:
                setStatus('Please connect your wallet to continue.')
                break
            case 1:
                setStatus('Please select a network to continue.')
                break
            case 2:
                setStatus('Set stream parameters and request permission.')
                break
            case 3:
                setStatus('Execute the stream to start pulling funds.')
                break
            case 4:
                setStatus('Pull funds from the active stream.')
                break
            case 5:
                setStatus('Send your pulled funds to MetaMask.')
                break
        }
    }, [activeStep])

    // Update timeline when stream parameters change
    useEffect(() => {
        const newStartTime = Math.floor(Date.now() / 1000)
        const endTime = newStartTime + parseInt(streamParams.duration)
        const totalDuration = endTime - newStartTime
        const amountPerSecond = parseFloat(streamParams.amountPerSecond)
        const maxAmount = parseFloat(streamParams.maxAmount)
        
        // Calculate current progress
        const currentTime = Math.floor(Date.now() / 1000)
        const elapsed = Math.min(currentTime - newStartTime, totalDuration)
        const progress = (elapsed / totalDuration) * 100
        
        // Calculate current amount without fixed precision
        const currentAmount = (elapsed * amountPerSecond).toString()

        setStreamTimeline({
            startTime: newStartTime,
            endTime,
            currentAmount,
            progress: Math.min(progress, 100)
        })
    }, [streamParams])

    // Update balances periodically
    useEffect(() => {
        const updateBalances = async () => {
            try {
                if (!connectedAccount || !sessionAccount || !publicClient) return

                // Get all balances in parallel
                const [userBalance, sessionBalance] = await Promise.all([
                    publicClient.getBalance({ address: connectedAccount }),
                    publicClient.getBalance({ address: sessionAccount.address })
                ])

                // Get gator balance if permission is granted
                let gatorBalance = '0'
                if (permissionResponse?.[0]?.address) {
                    const gatorAddress = permissionResponse[0].address
                    console.log('Fetching balance for gator account:', gatorAddress)
                    const balance = await publicClient.getBalance({
                        address: gatorAddress
                    })
                    gatorBalance = formatEther(balance)
                    console.log('Gator balance:', gatorBalance, 'ETH')
                }

                setBalances({
                    user: formatEther(userBalance),
                    session: formatEther(sessionBalance),
                    gator: gatorBalance
                })
            } catch (err) {
                console.error('Error updating balances:', err)
            }
        }

        // Update immediately
        updateBalances()

        // Then update every 5 seconds
        const interval = setInterval(updateBalances, 5000)

        return () => clearInterval(interval)
    }, [connectedAccount, sessionAccount, publicClient, permissionResponse])

    const markStepAsExecuted = useCallback((step: number) => {
        const newExecutedSteps = { ...executedSteps, [step]: true }
        setExecutedSteps(newExecutedSteps)
        localStorage.setItem('executedSteps', JSON.stringify(newExecutedSteps))
    }, [executedSteps])

    const disconnectWallet = useCallback(() => {
        localStorage.removeItem('sessionKey')
        localStorage.removeItem('streamPermission')
        localStorage.removeItem('totalPulled')
        localStorage.removeItem('executedSteps')
        setSessionKey(null)
        setSessionAccount(null)
        setConnectedAccount(null)
        setWalletClient(null)
        setActiveStep(0)
        setPermissionResponse(null)
        setUserOpHash(null)
        setReceipt(null)
        setBalances({ user: '0', session: '0', gator: '0' })
        setTotalPulled('0')
        setExecutedSteps({})
        setStatus('Please connect your wallet to continue.')
    }, [])

    // Initialize wallet client and connect
    const initializeWallet = async () => {
        try {
            setIsLoading(true)
            
            // Request account access
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            }) as `0x${string}`[]
            
            setConnectedAccount(accounts[0])

            // Create wallet client
            const client = createWalletClient({
                chain: sepolia,
                transport: custom(window.ethereum),
            }).extend(erc7715ProviderActions())

            setWalletClient(client)

            // Generate session account only if not already exists
            if (!sessionKey) {
                const newPrivateKey = generatePrivateKey()
                localStorage.setItem('sessionKey', newPrivateKey)
                setSessionKey(newPrivateKey)
            }

            setStepCompleted(true)
            setStatus('Wallet connected successfully!')
        } catch (err: any) {
            console.error('Failed to initialize wallet:', err)
            setError(err.message || 'Failed to initialize wallet')
        } finally {
            setIsLoading(false)
        }
    }

    const handleNetworkSwitch = async () => {
        try {
            setIsLoading(true)
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: selectedNetwork }],
            })
            setStepCompleted(true)
            setStatus('Network switched successfully!')
        } catch (err: any) {
            console.error('Failed to switch network:', err)
            if (err.code === 4902) {
                setError('Network not added to MetaMask. Please add it first.')
            } else {
                setError('Failed to switch network')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const requestPermission = async () => {
        if (!walletClient || !sessionAccount) {
            setError('Wallet client or session account not initialized')
            return false
        }

        try {
            setIsLoading(true)
            setStatus('Requesting stream permission...')

            const expiry = streamTimeline.startTime + parseInt(streamParams.duration)
            console.log('expire', expiry)
            console.log('startTime', streamTimeline.startTime)

            const grantedPermissions = await walletClient.grantPermissions([{
                chainId: sepolia.id,
                expiry,
                signer: {
                    type: "account",
                    data: {
                        address: sessionAccount.address,
                    },
                },
                permission: {
                    type: "native-token-stream",
                    data: {
                        initialAmount: parseEther(streamParams.initialAmount),
                        amountPerSecond: parseEther(streamParams.amountPerSecond),
                        maxAmount: parseEther(streamParams.maxAmount),
                        startTime: streamTimeline.startTime,
                        justification: "Native token streaming permission",
                    },
                },
            }])
            
            console.log('grantedPermissions', grantedPermissions)

            if (grantedPermissions?.length > 0) {
                setPermissionResponse(grantedPermissions)
                // Store permission in local storage with full details
                const permissionData = {
                    gatorAddress: grantedPermissions[0].address,
                    permission: grantedPermissions
                }
                localStorage.setItem('streamPermission', JSON.stringify(permissionData))
                
                // Get and log the gator account balance
                const gatorAddress = grantedPermissions[0].address
                console.log('Gator Account Address:', gatorAddress)
                const balance = await publicClient.getBalance({
                    address: gatorAddress
                })
                setBalances(prev => ({
                    ...prev,
                    gator: formatEther(balance)
                }))
                console.log('Gator Account Balance:', formatEther(balance), 'ETH')
                
                setStatus('Permission granted successfully!')
                setStepCompleted(true)
                return true
            } else {
                throw new Error('No permissions granted')
            }
        } catch (err: any) {
            console.error('Permission request error:', err)
            setError(err.message || 'Failed to request permission')
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const executeStream = async () => {
        if (!walletClient || !permissionResponse?.[0] || !sessionAccount) {
            setError('Missing wallet client, permission, or session account')
            return false
        }

        try {
            // Validate initial amount against max allowed amount
            const initialAmount = BigInt(permissionResponse[0].permission.data.initialAmount)
            const maxAmount = BigInt(permissionResponse[0].permission.data.maxAmount)
            const amountPerSecond = BigInt(permissionResponse[0].permission.data.amountPerSecond)
            const startTime = BigInt(permissionResponse[0].permission.data.startTime)
            const currentTime = BigInt(Math.floor(Date.now() / 1000))
            const elapsed = currentTime - startTime
            
            // Calculate total allowed amount at this point
            const streamedAmount = elapsed * amountPerSecond
            // Total allowed amount should be the minimum of:
            // 1. maxAmount (overall cap)
            // 2. streamedAmount (what's available based on time elapsed)
            const totalAllowedAmount = maxAmount < streamedAmount ? maxAmount : streamedAmount
            
            // Check if initial amount would exceed allowed amount
            if (initialAmount > totalAllowedAmount) {
                const formattedAllowed = formatEther(totalAllowedAmount)
                const formattedInitial = formatEther(initialAmount)
                setError(`Initial amount (${formattedInitial} ETH) exceeds allowed stream amount (${formattedAllowed} ETH)`)
                return false
            }

            setIsLoading(true)
            setStatus('Executing stream...')

            // These properties must be extracted from the permission response.
            const permissionsContext = permissionResponse[0].context
            const delegationManager = permissionResponse[0].signerMeta.delegationManager
            const accountMetadata = permissionResponse[0].accountMeta
            
            const fees = await publicClient.estimateFeesPerGas()

            // Calls without permissionsContext and delegationManager will be executed 
            // as a normal user operation.
            const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
                publicClient,
                account: sessionAccount,
                calls: [{
                    to: sessionAccount.address,
                    data: "0x",
                    value: 0n,
                },
                {
                    to: sessionAccount.address,
                    data: "0x",
                    value: initialAmount,
                    permissionsContext,
                    delegationManager,
                }],
                // Appropriate values must be used for fee-per-gas. 
                maxFeePerGas: fees.maxFeePerGas,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
                accountMetadata,
            })

            setUserOpHash(userOpHash)
            console.log(userOpHash)

            const txReceipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
                timeout: 60_000
            })

            setReceipt(txReceipt)
            console.log(txReceipt)

            setStatus('Stream started successfully!')
            setStepCompleted(true)
            markStepAsExecuted(3) // Mark Execute Stream step as completed
            return true
        } catch (err: any) {
            console.error('Stream execution error:', err)
            setError(err.message || 'Failed to execute stream')
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const pullStream = async () => {
        if (!walletClient || !permissionResponse?.[0] || !sessionAccount) {
            setError('Missing wallet client, permission, or session account')
            return false
        }

        try {
            setIsLoading(true)
            setStatus('Pulling from stream...')

            // Extract necessary data from permission response
            const permissionsContext = permissionResponse[0].context
            const delegationManager = permissionResponse[0].signerMeta.delegationManager
            const accountMetadata = permissionResponse[0].accountMeta
            
            const fees = await publicClient.estimateFeesPerGas()

            // Send user operation to pull from stream
            const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
                publicClient,
                account: sessionAccount,
                calls: [{
                    to: sessionAccount.address,
                    data: "0x",
                    value: parseEther(pullAmount),
                    permissionsContext,
                    delegationManager,
                }],
                maxFeePerGas: fees.maxFeePerGas,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
                accountMetadata,
            })

            setUserOpHash(userOpHash)
            console.log('Pull operation hash:', userOpHash)

            const txReceipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
                timeout: 60_000
            })

            setReceipt(txReceipt)
            console.log('Pull operation receipt:', txReceipt)

            // Update total pulled amount
            const newTotalPulled = (parseFloat(totalPulled) + parseFloat(pullAmount)).toString()
            setTotalPulled(newTotalPulled)
            localStorage.setItem('totalPulled', newTotalPulled)

            setStatus('Successfully pulled from stream!')
            setStepCompleted(true)
            markStepAsExecuted(4) // Mark Pull Stream step as completed
            return true
        } catch (err: any) {
            console.error('Stream pull error:', err)
            setError(err.message || 'Failed to pull from stream')
            return false
        } finally {
            setIsLoading(false)
        }
    }

    // Add send funds function
    const sendFunds = async () => {
        if (!walletClient || !sessionAccount || !connectedAccount) {
            setError('Missing wallet client, session account, or connected account')
            return false
        }

        try {
            setIsLoading(true)
            setStatus('Sending funds to MetaMask account...')

            const sessionBalance = await publicClient.getBalance({
                address: sessionAccount.address
            })

            if (sessionBalance <= 0n) {
                setError('No funds to send')
                return false
            }

            const fees = await publicClient.estimateFeesPerGas()
            
            // Subtract fees from amount to ensure transaction can go through
            const amountToSend = sessionBalance

            if (amountToSend <= 0n) {
                setError('Insufficient balance to cover gas fees')
                return false
            }

            const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
                account: sessionAccount,
                calls: [{
                    to: connectedAccount,
                    data: "0x",
                    value: amountToSend
                }],
                maxFeePerGas: fees.maxFeePerGas,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas
            })

            setUserOpHash(userOpHash)
            console.log('Send funds operation hash:', userOpHash)

            const txReceipt = await bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
                timeout: 60_000
            })

            setReceipt(txReceipt)
            console.log('Send funds operation receipt:', txReceipt)

            setStatus('Successfully sent funds to MetaMask account!')
            setStepCompleted(true)
            return true
        } catch (err: any) {
            console.error('Send funds error:', err)
            setError(err.message || 'Failed to send funds')
            return false
        } finally {
            setIsLoading(false)
        }
    }

    // Update handleAction to include the send funds step
    const handleAction = async () => {
        try {
            setError('')
            setStepCompleted(false)
            
            switch (activeStep) {
                case 0:
                    await initializeWallet()
                    break
                case 1:
                    await handleNetworkSwitch()
                    break
                case 2:
                    await requestPermission()
                    break
                case 3:
                    await executeStream()
                    break
                case 4:
                    await pullStream()
                    break
                case 5:
                    await sendFunds()
                    break
            }
        } catch (err: any) {
            console.error('Step error:', err)
            setError(err.message || 'An error occurred')
        }
    }

    const handleStreamParamsChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setStreamParams(prev => ({
            ...prev,
            [field]: event.target.value
        }))
    }

    const handleMaxAmount = () => {
        setStreamParams(prev => ({
            ...prev,
            maxAmount: balances.user
        }))
    }

    const formatDuration = (seconds: number): string => {
        const units: [string, number][] = [
            ['month', 30 * 24 * 60 * 60],
            ['week', 7 * 24 * 60 * 60],
            ['day', 24 * 60 * 60],
            ['hour', 60 * 60],
            ['minute', 60],
            ['second', 1]
        ]
        
        let remainingSeconds = seconds
        const parts: string[] = []
        
        for (const [unit, secondsInUnit] of units) {
            if (remainingSeconds >= secondsInUnit) {
                const count = Math.floor(remainingSeconds / secondsInUnit)
                parts.push(`${count} ${unit}${count !== 1 ? 's' : ''}`)
                remainingSeconds %= secondsInUnit
            }
        }
        
        if (parts.length === 0) {
            return '0 seconds'
        }
        
        if (parts.length === 1) {
            return parts[0]
        }
        
        const lastPart = parts.pop()
        return `${parts.join(', ')} and ${lastPart}`
    }

    const getStreamParameters = useCallback(() => {
        if (!permissionResponse?.[0]?.permission?.data) return null

        return {
            initialAmount: formatEther(BigInt(permissionResponse[0].permission.data.initialAmount)),
            amountPerSecond: formatEther(BigInt(permissionResponse[0].permission.data.amountPerSecond)),
            maxAmount: formatEther(BigInt(permissionResponse[0].permission.data.maxAmount)),
            startTime: new Date(Number(permissionResponse[0].permission.data.startTime) * 1000).toLocaleString(),
            expiry: new Date(Number(permissionResponse[0].expiry) * 1000).toLocaleString(),
            duration: formatDuration(permissionResponse[0].expiry - permissionResponse[0].permission.data.startTime)
        }
    }, [permissionResponse])

    const getStepContent = (step: number) => {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail: string, index: number) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5 }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        <Typography 
                            variant="body2" 
                            sx={{ mb: 2 }}
                            component="div"
                        >
                            {connectedAccount ? (
                                <Box>
                                    <Typography component="span">Connected: {connectedAccount}</Typography>
                                </Box>
                            ) : (
                                'Please connect your wallet using the button below.'
                            )}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || connectedAccount !== null}
                            >
                                {isLoading ? <CircularProgress size={24} /> : connectedAccount ? 'Connected' : 'Connect Wallet'}
                            </Button>
                            {connectedAccount && (
                                <Button
                                    variant="outlined"
                                    onClick={() => setActiveStep(prev => prev + 1)}
                                    color="success"
                                >
                                    Next
                                </Button>
                            )}
                        </Box>
                    </Box>
                )
            case 1:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail: string, index: number) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5 }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Select Network</InputLabel>
                            <Select
                                value={selectedNetwork}
                                onChange={(e) => setSelectedNetwork(e.target.value as `0x${string}`)}
                                label="Select Network"
                            >
                                <MenuItem value="0xaa36a7">Sepolia (Chain ID: 11155111)</MenuItem>
                                <MenuItem value="0x1" disabled>Ethereum Mainnet - Not Available</MenuItem>
                            </Select>
                        </FormControl>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || currentNetwork === selectedNetwork}
                            >
                                {isLoading ? <CircularProgress size={24} /> : currentNetwork === selectedNetwork ? 'Network Connected' : 'Switch Network'}
                            </Button>
                            {currentNetwork === selectedNetwork && (
                                <Button
                                    variant="outlined"
                                    onClick={() => setActiveStep(prev => prev + 1)}
                                    color="success"
                                >
                                    Next
                                </Button>
                            )}
                        </Box>
                    </Box>
                )
            case 2:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail: string, index: number) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5 }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        {permissionResponse ? (
                            <Box sx={{ mb: 2 }}>
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: 'success.main',
                                        fontWeight: 'medium',
                                        mb: 2
                                    }}
                                >
                                    ✓ Permission already granted
                                </Typography>
                                
                                <Paper sx={{ p: 2, bgcolor: '#f8f9fa', mb: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Granted Stream Parameters
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        This permission allows your Session Account to pull funds from the Gator Account according to the stream parameters below.
                                    </Typography>
                                    {(() => {
                                        const params = getStreamParameters()
                                        if (!params) return null

                                        return (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Initial Amount
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {params.initialAmount} ETH
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Amount Per Second
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {params.amountPerSecond} ETH
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Maximum Amount
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {params.maxAmount} ETH
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Duration
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {params.duration}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Start Time
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {params.startTime}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Expiry
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {params.expiry}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )
                                    })()}
                                </Paper>

                                <Paper sx={{ p: 2, bgcolor: '#fff3e0', mb: 2, border: '1px solid #ffe0b2' }}>
                                    <Typography variant="subtitle2" gutterBottom sx={{ color: '#e65100' }}>
                                        Important: Fund Your Gator Account
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        The Gator Account is automatically created by MetaMask Flask to hold the funds for streaming. Make sure to send some ETH to this account before proceeding.
                                    </Typography>
                                    {permissionResponse?.[0]?.address && (
                                        <>
                                            <Box sx={{ mb: 1 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Gator Account Address
                                                </Typography>
                                                <Typography 
                                                    variant="body2" 
                                                    component="code" 
                                                    sx={{ 
                                                        bgcolor: '#fff8e1',
                                                        p: 0.5,
                                                        borderRadius: 0.5,
                                                        fontFamily: 'monospace',
                                                        display: 'block'
                                                    }}
                                                >
                                                    {permissionResponse[0].address}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    Current Balance
                                                </Typography>
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ 
                                                        color: parseFloat(balances.gator) > 0 ? 'success.main' : 'error.main',
                                                        fontWeight: 'medium',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5
                                                    }}
                                                >
                                                    <Box component="span" sx={{ fontSize: '1.1rem' }}>
                                                        {parseFloat(balances.gator) > 0 ? '💰' : '⚠️'}
                                                    </Box>
                                                    {balances.gator} ETH
                                                </Typography>
                                            </Box>
                                        </>
                                    )}
                                </Paper>

                                <Button
                                    variant="contained"
                                    onClick={() => setActiveStep(prev => prev + 1)}
                                    color="success"
                                >
                                    Proceed to Execute Stream
                                </Button>
                            </Box>
                        ) : (
                            <>
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        Set the parameters for the stream permission. This will allow your Session Account to pull funds from the Gator Account based on these rules.
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        label="Initial Amount (ETH)"
                                        type="number"
                                        value={streamParams.initialAmount}
                                        onChange={handleStreamParamsChange('initialAmount')}
                                        sx={{ mb: 2 }}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Amount Per Second (ETH)"
                                        type="number"
                                        value={streamParams.amountPerSecond}
                                        onChange={handleStreamParamsChange('amountPerSecond')}
                                        sx={{ mb: 2 }}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Duration (seconds)"
                                        type="number"
                                        value={streamParams.duration}
                                        onChange={handleStreamParamsChange('duration')}
                                        sx={{ mb: 2 }}
                                    />
                                    <Box sx={{ position: 'relative' }}>
                                        <TextField
                                            fullWidth
                                            label="Max Amount (ETH)"
                                            type="number"
                                            value={streamParams.maxAmount}
                                            onChange={handleStreamParamsChange('maxAmount')}
                                            sx={{ mb: 3 }}
                                            InputProps={{
                                                endAdornment: (
                                                    <Button
                                                        onClick={handleMaxAmount}
                                                        sx={{
                                                            minWidth: 'auto',
                                                            px: 1,
                                                            position: 'absolute',
                                                            right: 8,
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            bgcolor: 'primary.main',
                                                            color: 'white',
                                                            '&:hover': {
                                                                bgcolor: 'primary.dark',
                                                            }
                                                        }}
                                                    >
                                                        MAX
                                                    </Button>
                                                ),
                                            }}
                                        />
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                position: 'absolute',
                                                right: 0,
                                                top: '100%',
                                                mt: 0.5,
                                                color: 'text.secondary'
                                            }}
                                        >
                                            Available: {balances.user} ETH
                                        </Typography>
                                    </Box>

                                    {/* Stream Timeline Visualization */}
                                    <Paper sx={{ p: 2, bgcolor: '#f8f9fa', mb: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Stream Timeline
                                        </Typography>
                                        <Box sx={{ mb: 2 }}>
                                            <LinearProgress 
                                                variant="determinate" 
                                                value={streamTimeline.progress}
                                                sx={{ 
                                                    height: 10, 
                                                    borderRadius: 5,
                                                    backgroundColor: '#e0e0e0',
                                                    '& .MuiLinearProgress-bar': {
                                                        backgroundColor: '#2196f3'
                                                    }
                                                }}
                                            />
                                        </Box>
                                        <Box sx={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between',
                                            mb: 1,
                                            flexDirection: 'column',
                                            gap: 1
                                        }}>
                                            <Box>
                                                <Typography variant="caption" display="block">
                                                    Start Time (Unix): {streamTimeline.startTime}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    UTC: {new Date(streamTimeline.startTime * 1000).toUTCString()}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" display="block">
                                                    End Time (Unix): {streamTimeline.endTime}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    UTC: {new Date(streamTimeline.endTime * 1000).toUTCString()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ 
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <Typography variant="body2">
                                                Rate: {streamParams.amountPerSecond} ETH/s
                                            </Typography>
                                            <Typography variant="body2">
                                                Max: {streamParams.maxAmount} ETH
                                            </Typography>
                                        </Box>
                                        <Box sx={{ 
                                            mt: 1,
                                            p: 1,
                                            bgcolor: '#e3f2fd',
                                            borderRadius: 1,
                                            textAlign: 'center'
                                        }}>
                                            <Typography variant="subtitle2">
                                                Total Stream Duration: {formatDuration(parseInt(streamParams.duration))}
                                            </Typography>
                                        </Box>
                                    </Paper>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="contained"
                                        onClick={handleAction}
                                        disabled={isLoading || !walletClient || !connectedAccount}
                                    >
                                        {isLoading ? <CircularProgress size={24} /> : 'Request Permission'}
                                    </Button>
                                    {stepCompleted && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => setActiveStep(prev => prev + 1)}
                                            color="success"
                                        >
                                            Next
                                        </Button>
                                    )}
                                </Box>
                            </>
                        )}
                    </Box>
                )
            case 3:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail: string, index: number) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5 }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        {executedSteps[3] ? (
                            <Box sx={{ mb: 2 }}>
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: 'success.main',
                                        fontWeight: 'medium',
                                        mb: 2
                                    }}
                                >
                                    ✓ Stream has been executed successfully
                                </Typography>
                                {userOpHash && (
                                    <Box sx={{ mb: 2 }}>
                                        <Box 
                                            sx={{ 
                                                border: '1px solid #e0e0e0',
                                                borderRadius: 1,
                                                p: 2,
                                                bgcolor: '#fafafa'
                                            }}
                                        >
                                            <Typography 
                                                variant="subtitle2" 
                                                sx={{ 
                                                    color: 'text.secondary',
                                                    mb: 1
                                                }}
                                                component="div"
                                            >
                                                Execute Stream Operation Details
                                            </Typography>
                                            <Box sx={{ mb: 2 }}>
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ 
                                                        fontFamily: 'monospace', 
                                                        wordBreak: 'break-all',
                                                        bgcolor: '#f5f5f5',
                                                        p: 1,
                                                        borderRadius: 0.5
                                                    }}
                                                    component="div"
                                                >
                                                    User Operation Hash: {userOpHash}
                                                </Typography>
                                            </Box>
                                            {receipt && receipt.receipt && (
                                                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                                    <Typography 
                                                        variant="body2" 
                                                        sx={{ color: 'success.main', fontWeight: 'medium', mb: 1 }}
                                                        component="div"
                                                    >
                                                        Execute Stream Operation Confirmed ✓
                                                    </Typography>
                                                    <Typography 
                                                        variant="body2" 
                                                        sx={{ 
                                                            fontFamily: 'monospace', 
                                                            wordBreak: 'break-all',
                                                            bgcolor: '#f5f5f5',
                                                            p: 1,
                                                            borderRadius: 0.5,
                                                            mb: 1
                                                        }}
                                                        component="div"
                                                    >
                                                        Transaction Hash: {receipt.receipt.transactionHash}
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        size="small"
                                                        component="a"
                                                        href={`https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        startIcon={<Box component="span" sx={{ fontSize: '1.1rem' }}>🔍</Box>}
                                                        sx={{ 
                                                            textTransform: 'none',
                                                            fontWeight: 'medium'
                                                        }}
                                                    >
                                                        View Transaction on Explorer
                                                    </Button>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                )}
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => setActiveStep(prev => prev - 1)}
                                        sx={{ minWidth: 100 }}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={() => setActiveStep(prev => prev + 1)}
                                        color="success"
                                    >
                                        Proceed to Pull Stream
                                    </Button>
                                </Box>
                            </Box>
                        ) : (
                            <>
                                <Typography 
                                    variant="body2" 
                                    sx={{ mb: 2, fontWeight: 'medium' }}
                                    component="div"
                                >
                                    {status}
                                </Typography>

                                <Paper sx={{ p: 2, bgcolor: '#f8f9fa', mb: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Stream Execution Details
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        This will pull funds from the Gator Account to your Session Account based on the granted permission.
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Initial Pull Amount
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                                                {(() => {
                                                    const params = getStreamParameters()
                                                    return params ? `${params.initialAmount} ETH` : '0 ETH'
                                                })()}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Session Account Balance
                                            </Typography>
                                            <Typography variant="body2">
                                                {balances.session} ETH
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Gator Account Balance
                                            </Typography>
                                            <Typography variant="body2">
                                                {balances.gator} ETH
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => setActiveStep(prev => prev - 1)}
                                        sx={{ minWidth: 100 }}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleAction}
                                        disabled={isLoading || !walletClient || !permissionResponse}
                                    >
                                        {isLoading ? <CircularProgress size={24} /> : 'Execute Stream'}
                                    </Button>
                                    {receipt && receipt.receipt && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => setActiveStep(prev => prev + 1)}
                                            color="success"
                                        >
                                            Next: Pull Stream
                                        </Button>
                                    )}
                                </Box>
                            </>
                        )}
                    </Box>
                )
            case 4:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail: string, index: number) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5 }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        {executedSteps[4] && (
                            <Box sx={{ mb: 2 }}>
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: 'success.main',
                                        fontWeight: 'medium',
                                        mb: 2
                                    }}
                                >
                                    ✓ Stream has been pulled successfully
                                </Typography>
                                {userOpHash && (
                                    <Box sx={{ mb: 2 }}>
                                        <Box 
                                            sx={{ 
                                                border: '1px solid #e0e0e0',
                                                borderRadius: 1,
                                                p: 2,
                                                bgcolor: '#fafafa'
                                            }}
                                        >
                                            <Typography 
                                                variant="subtitle2" 
                                                sx={{ 
                                                    color: 'text.secondary',
                                                    mb: 1
                                                }}
                                                component="div"
                                            >
                                                Pull Stream Operation Details
                                            </Typography>
                                            <Box sx={{ mb: 2 }}>
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ 
                                                        fontFamily: 'monospace', 
                                                        wordBreak: 'break-all',
                                                        bgcolor: '#f5f5f5',
                                                        p: 1,
                                                        borderRadius: 0.5
                                                    }}
                                                    component="div"
                                                >
                                                    User Operation Hash: {userOpHash}
                                                </Typography>
                                            </Box>
                                            {receipt && receipt.receipt && (
                                                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                                    <Typography 
                                                        variant="body2" 
                                                        sx={{ color: 'success.main', fontWeight: 'medium', mb: 1 }}
                                                        component="div"
                                                    >
                                                        Pull Stream Operation Confirmed ✓
                                                    </Typography>
                                                    <Typography 
                                                        variant="body2" 
                                                        sx={{ 
                                                            fontFamily: 'monospace', 
                                                            wordBreak: 'break-all',
                                                            bgcolor: '#f5f5f5',
                                                            p: 1,
                                                            borderRadius: 0.5,
                                                            mb: 1
                                                        }}
                                                        component="div"
                                                    >
                                                        Transaction Hash: {receipt.receipt.transactionHash}
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        size="small"
                                                        component="a"
                                                        href={`https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        startIcon={<Box component="span" sx={{ fontSize: '1.1rem' }}>🔍</Box>}
                                                        sx={{ 
                                                            textTransform: 'none',
                                                            fontWeight: 'medium'
                                                        }}
                                                    >
                                                        View Transaction on Explorer
                                                    </Button>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        )}
                        <Box sx={{ mb: 3 }}>
                            <Paper sx={{ p: 2, bgcolor: '#f8f9fa', mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom component="div">
                                    Stream Status
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Your Session Account can pull funds from the Gator Account based on the granted permission. The available amount is limited by both the stream rules and the current Gator Account balance.
                                </Typography>
                                <Box sx={{ 
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 1
                                }}>
                                    <Typography variant="body2" component="div">
                                        Available to Pull:
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            fontWeight: 'medium',
                                            color: 'primary.main'
                                        }}
                                        component="div"
                                    >
                                        {availableAmount} ETH
                                    </Typography>
                                </Box>
                                <Box sx={{ 
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 1
                                }}>
                                    <Typography variant="body2" component="div">
                                        Total Pulled So Far:
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ fontWeight: 'medium' }}
                                        component="div"
                                    >
                                        {totalPulled} ETH
                                    </Typography>
                                </Box>
                                <Box sx={{ 
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <Typography variant="body2" component="div">
                                        Current Session Balance:
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ fontWeight: 'medium' }}
                                        component="div"
                                    >
                                        {balances.session} ETH
                                    </Typography>
                                </Box>
                            </Paper>

                            <TextField
                                fullWidth
                                label="Pull Amount (ETH)"
                                type="number"
                                value={pullAmount}
                                onChange={(e) => setPullAmount(e.target.value)}
                                sx={{ mb: 1 }}
                                error={parseFloat(pullAmount) > parseFloat(availableAmount)}
                                helperText={parseFloat(pullAmount) > parseFloat(availableAmount) ? 
                                    'Amount exceeds available balance' : 
                                    'Enter the amount you want to pull from the stream'
                                }
                            />
                            <Button
                                variant="text"
                                onClick={() => setPullAmount(availableAmount)}
                                sx={{ mb: 2 }}
                            >
                                Set Max Available ({availableAmount} ETH)
                            </Button>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                onClick={() => setActiveStep(prev => prev - 1)}
                                sx={{ minWidth: 100 }}
                            >
                                Back
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || !walletClient || !permissionResponse || parseFloat(pullAmount) > parseFloat(availableAmount)}
                            >
                                {isLoading ? <CircularProgress size={24} /> : 'Pull Stream'}
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => setActiveStep(prev => prev + 1)}
                                color="success"
                            >
                                Next: Send Funds
                            </Button>
                        </Box>
                    </Box>
                )
            case 5:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail: string, index: number) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5 }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        <Typography 
                            variant="body2" 
                            sx={{ mb: 2, fontWeight: 'medium' }}
                            component="div"
                        >
                            {status}
                        </Typography>
                        {userOpHash && (
                            <Box sx={{ mb: 2 }}>
                                <Box 
                                    sx={{ 
                                        border: '1px solid #e0e0e0',
                                        borderRadius: 1,
                                        p: 2,
                                        bgcolor: '#fafafa'
                                    }}
                                >
                                    <Typography 
                                        variant="subtitle2" 
                                        sx={{ 
                                            color: 'text.secondary',
                                            mb: 1
                                        }}
                                        component="div"
                                    >
                                        Return Funds Operation Details
                                    </Typography>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography 
                                            variant="body2" 
                                            sx={{ 
                                                fontFamily: 'monospace', 
                                                wordBreak: 'break-all',
                                                bgcolor: '#f5f5f5',
                                                p: 1,
                                                borderRadius: 0.5
                                            }}
                                            component="div"
                                        >
                                            User Operation Hash: {userOpHash}
                                        </Typography>
                                    </Box>
                                    {receipt && receipt.receipt && (
                                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                            <Typography 
                                                variant="body2" 
                                                sx={{ color: 'success.main', fontWeight: 'medium', mb: 1 }}
                                                component="div"
                                            >
                                                Return Funds Operation Confirmed ✓
                                            </Typography>
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    fontFamily: 'monospace', 
                                                    wordBreak: 'break-all',
                                                    bgcolor: '#f5f5f5',
                                                    p: 1,
                                                    borderRadius: 0.5,
                                                    mb: 1
                                                }}
                                                component="div"
                                            >
                                                Transaction Hash: {receipt.receipt.transactionHash}
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                size="small"
                                                component="a"
                                                href={`https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                startIcon={<Box component="span" sx={{ fontSize: '1.1rem' }}>🔍</Box>}
                                                sx={{ 
                                                    textTransform: 'none',
                                                    fontWeight: 'medium'
                                                }}
                                            >
                                                View Transaction on Explorer
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        )}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                onClick={() => setActiveStep(prev => prev - 1)}
                                sx={{ minWidth: 100 }}
                            >
                                Back
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || !walletClient || !permissionResponse}
                            >
                                {isLoading ? <CircularProgress size={24} /> : 'Send Funds'}
                            </Button>
                        </Box>
                    </Box>
                )
            default:
                return null
        }
    }

    return (
        <Box sx={{ 
            position: 'relative', 
            minHeight: '100vh',
            maxWidth: '100%',
            width: '100%',
            overflow: 'hidden',
            pb: '120px'
        }}>
            <Box sx={{ 
                maxWidth: 800,
                mx: 'auto',
                p: 3,
                paddingBottom: '120px'
            }}>
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    mb: 3
                }}>
                    <Typography variant="h4">
                        ERC-7715 Native Token Stream Demo
                    </Typography>
                    {connectedAccount && (
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={disconnectWallet}
                        >
                            Disconnect
                        </Button>
                    )}
                </Box>

                <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        This demo requires{' '}
                        <Link 
                            href="https://chromewebstore.google.com/detail/metamask-flask-developmen/ljfoeinjpaedjfecbmggjgodbgkmjkjk"
                            target="_blank"
                            rel="noopener"
                        >
                            MetaMask Flask
                        </Link>{' '}
                        and showcases how to use{' '}
                        <Link href="https://eips.ethereum.org/EIPS/eip-7715" target="_blank" rel="noopener">
                            ERC-7715
                        </Link>{' '}
                        for permission requests and{' '}
                        <Link href="https://eips.ethereum.org/EIPS/eip-7710" target="_blank" rel="noopener">
                            ERC-7710
                        </Link>{' '}
                        for delegated execution of native token streams.
                    </Typography>
                </Paper>

                {connectedAccount && (
                    <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Connected Accounts
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* MetaMask Account */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    MetaMask Account
                                </Typography>
                                <Typography 
                                    variant="body2" 
                                    component="code" 
                                    sx={{ 
                                        bgcolor: '#f1f3f4',
                                        p: 0.5,
                                        borderRadius: 0.5,
                                        fontFamily: 'monospace',
                                        display: 'block',
                                        mb: 1
                                    }}
                                >
                                    {connectedAccount}
                                </Typography>
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: 'success.main',
                                        fontWeight: 'medium',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5
                                    }}
                                >
                                    <Box component="span" sx={{ fontSize: '1.1rem' }}>💰</Box>
                                    {balances.user} ETH
                                </Typography>
                            </Box>

                            {/* Session Account */}
                            {sessionAccount && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        Session Account
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        component="code" 
                                        sx={{ 
                                            bgcolor: '#f1f3f4',
                                            p: 0.5,
                                            borderRadius: 0.5,
                                            fontFamily: 'monospace',
                                            display: 'block',
                                            mb: 1
                                        }}
                                    >
                                        {sessionAccount.address}
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            color: 'success.main',
                                            fontWeight: 'medium',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5
                                        }}
                                    >
                                        <Box component="span" sx={{ fontSize: '1.1rem' }}>💰</Box>
                                        {balances.session} ETH
                                    </Typography>
                                </Box>
                            )}

                            {/* Gator Account */}
                            {permissionResponse?.[0]?.address && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        Gator Account
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        component="code" 
                                        sx={{ 
                                            bgcolor: '#f1f3f4',
                                            p: 0.5,
                                            borderRadius: 0.5,
                                            fontFamily: 'monospace',
                                            display: 'block',
                                            mb: 1
                                        }}
                                    >
                                        {permissionResponse[0].address}
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            color: 'success.main',
                                            fontWeight: 'medium',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5
                                        }}
                                    >
                                        <Box component="span" sx={{ fontSize: '1.1rem' }}>💰</Box>
                                        {balances.gator} ETH
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                )}

                {error && (
                    <Paper sx={{ p: 2, mb: 3, bgcolor: '#f2dede', color: '#a94442' }}>
                        <Typography variant="body2">{error}</Typography>
                    </Paper>
                )}

                <Paper sx={{ p: 3 }}>
                    <Stepper activeStep={activeStep} orientation="vertical">
                        {STEPS.map((step, index) => (
                            <Step key={step.label}>
                                <StepLabel>
                                    <Typography variant="subtitle1">{step.label}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {step.description}
                                    </Typography>
                                </StepLabel>
                                <StepContent>
                                    {getStepContent(index)}
                                </StepContent>
                            </Step>
                        ))}
                    </Stepper>
                </Paper>
            </Box>

            {/* Footer */}
            <Box
                component="footer"
                sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    width: '100%',
                    bgcolor: '#f8f9fa',
                    borderTop: '1px solid #e0e0e0',
                }}
            >
                <Box 
                    sx={{ 
                        maxWidth: 800,
                        width: '100%',
                        mx: 'auto',
                        px: 3,
                        py: 3,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 2
                    }}
                >
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Resources
                        </Typography>
                        <Box sx={{ 
                            display: 'flex', 
                            gap: 2,
                            flexWrap: 'wrap'
                        }}>
                            <Link 
                                href="https://eips.ethereum.org/EIPS/eip-7715" 
                                target="_blank" 
                                rel="noopener"
                                sx={{ 
                                    color: 'primary.main',
                                    textDecoration: 'none',
                                    '&:hover': {
                                        textDecoration: 'underline'
                                    }
                                }}
                            >
                                ERC-7715
                            </Link>
                            <Link 
                                href="https://eips.ethereum.org/EIPS/eip-7710" 
                                target="_blank" 
                                rel="noopener"
                                sx={{ 
                                    color: 'primary.main',
                                    textDecoration: 'none',
                                    '&:hover': {
                                        textDecoration: 'underline'
                                    }
                                }}
                            >
                                ERC-7710
                            </Link>
                            <Link 
                                href="https://docs.gator.metamask.io" 
                                target="_blank" 
                                rel="noopener"
                                sx={{ 
                                    color: 'primary.main',
                                    textDecoration: 'none',
                                    '&:hover': {
                                        textDecoration: 'underline'
                                    }
                                }}
                            >
                                Delegation Toolkit
                            </Link>
                            <Link 
                                href="https://chromewebstore.google.com/detail/metamask-flask-developmen/ljfoeinjpaedjfecbmggjgodbgkmjkjk" 
                                target="_blank" 
                                rel="noopener"
                                sx={{ 
                                    color: 'primary.main',
                                    textDecoration: 'none',
                                    '&:hover': {
                                        textDecoration: 'underline'
                                    }
                                }}
                            >
                                MetaMask Flask
                            </Link>
                        </Box>
                    </Box>
                    <Box 
                        sx={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                        }}
                    >
                        <Typography 
                            variant="body2" 
                            sx={{ 
                                color: 'text.secondary',
                                fontWeight: 500,
                                letterSpacing: 0.5
                            }}
                        >
                            © {new Date().getFullYear()}
                        </Typography>
                        <Link
                            href="https://github.com/miguelmota"
                            target="_blank"
                            rel="noopener"
                            sx={{ 
                                color: 'text.primary',
                                textDecoration: 'none',
                                fontWeight: 500,
                                '&:hover': {
                                    color: 'text.primary',
                                    textDecoration: 'underline'
                                }
                            }}
                        >
                            Miguel Mota
                        </Link>
                    </Box>
                </Box>
            </Box>
        </Box>
    )
} 