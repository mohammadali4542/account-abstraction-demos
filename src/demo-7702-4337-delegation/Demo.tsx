import React, { useState } from 'react'
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
    StepContent
} from '@mui/material'
import { useDemo } from './useDemo'

const STEPS = [
    {
        label: 'Connect Wallet',
        description: 'Connect your MetaMask wallet to get started.',
        details: [
            'This step connects your MetaMask wallet to the application.',
            'A smart account will be created for you that supports EIP-7702 delegations.',
            'If this is your first time, the smart account will be deployed.'
        ]
    },
    {
        label: 'Select Network',
        description: 'Choose the network you want to operate on.',
        details: [
            'Select the blockchain network where you want to execute the delegation.',
            'Currently supporting Sepolia testnet, Gnosis Chain, and Ethereum Mainnet.',
            'Make sure you have enough funds on the selected network for transaction fees.'
        ]
    },
    {
        label: 'Sign Delegation',
        description: 'Authorize a delegate smart account to act on your behalf.',
        details: [
            'This step creates a delegation that authorizes another smart account to act on your behalf.',
            'The delegation is signed using your MetaMask wallet.',
            'The delegate will be able to execute specific actions you approve.',
            'This is a gasless signature - no transaction fees required for this step.'
        ]
    },
    {
        label: 'Mint & Transfer Tokens',
        description: 'Mint test tokens and transfer them to your wallet.',
        details: [
            'The delegate will mint 1000 TEST tokens to the smart account.',
            'Then it will transfer these tokens to your MetaMask wallet.',
            'This demonstrates the delegate executing multiple transactions on your behalf.',
            'All operations are bundled into a single user operation.'
        ]
    },
    {
        label: 'Permit Approve and TransferFrom',
        description: 'Execute a signed user operation to transfer tokens from your wallet.',
        details: [
            'First, approve the delegate to spend 10 TEST tokens from your wallet.',
            'Then, the delegate will transfer those tokens from your wallet to the delegator smart account.',
            'This demonstrates using the signed delegation to execute transactions on your behalf.',
            'Once submitted, you can track your transaction on Etherscan.'
        ]
    }
]

export function Demo() {
    const {
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
        connect,
        signDelegation,
        mintAndTransferTokens,
        approveAndTransfer,
        balances,
        setStatus
    } = useDemo()

    const [activeStep, setActiveStep] = useState(0)
    const [selectedNetwork, setSelectedNetwork] = useState("0xaa36a7")
    const [stepCompleted, setStepCompleted] = useState(false)

    const handleAction = async () => {
        try {
            setStepCompleted(false)
            switch (activeStep) {
                case 0:
                    const connected = await connect()
                    setStepCompleted(connected)
                    if (!connected) {
                        setStatus('Failed to connect wallet. Please try again.')
                    }
                    break
                case 1:
                    if (window.ethereum) {
                        try {
                            await window.ethereum.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: selectedNetwork }],
                            })
                            setStepCompleted(true)
                        } catch (switchError: any) {
                            if (switchError.code === 4902) {
                                console.error('Chain not added to MetaMask')
                                setStatus('Network not added to MetaMask. Please add it first.')
                            } else {
                                setStatus('Failed to switch network. Please try again.')
                            }
                            throw switchError
                        }
                    }
                    break
                case 2:
                    const signed = await signDelegation()
                    setStepCompleted(signed)
                    if (!signed) {
                        setStatus('Failed to sign delegation. Please try again.')
                    }
                    break
                case 3:
                    const minted = await mintAndTransferTokens()
                    setStepCompleted(minted)
                    if (!minted) {
                        setStatus('Failed to mint and transfer tokens. Please try again.')
                    }
                    break
                case 4:
                    const executed = await approveAndTransfer()
                    setStepCompleted(executed)
                    if (!executed) {
                        setStatus('Failed to execute permit and transfer. Please try again.')
                    }
                    break
            }
        } catch (err: any) {
            console.error('Step error:', err)
            setStepCompleted(false)
            // Set appropriate error message based on the step
            switch (activeStep) {
                case 0:
                    setStatus('Failed to connect wallet. Please try again.')
                    break
                case 1:
                    setStatus('Failed to switch network. Please try again.')
                    break
                case 2:
                    setStatus('Failed to sign delegation. Please try again.')
                    break
                case 3:
                    setStatus('Failed to mint and transfer tokens. Please try again.')
                    break
                case 4:
                    setStatus('Failed to execute permit and transfer. Please try again.')
                    break
                default:
                    setStatus('An error occurred. Please try again.')
            }
        }
    }

    const handleNext = () => {
        setActiveStep((prevStep) => {
            const nextStep = prevStep + 1
            setStatus('')
            switch (nextStep) {
                case 0:
                    setStatus('Please connect your wallet to continue.')
                    break
                case 1:
                    setStatus('Please select a network to continue.')
                    break
                case 2:
                    setStatus('Please sign the delegation to continue.')
                    break
                case 3:
                    setStatus('Ready to mint and transfer tokens.')
                    break
                case 4:
                    setStatus('Ready to execute permit and transfer operation.')
                    break
                default:
                    setStatus('')
            }
            return nextStep
        })
        setStepCompleted(false)
    }

    const handleBack = () => {
        setActiveStep((prevStep) => {
            const nextStep = prevStep - 1
            setStatus('')
            switch (nextStep) {
                case 0:
                    setStatus('Please connect your wallet to continue.')
                    break
                case 1:
                    setStatus('Please select a network to continue.')
                    break
                case 2:
                    setStatus('Please sign the delegation to continue.')
                    break
                case 3:
                    setStatus('Ready to mint and transfer tokens.')
                    break
                case 4:
                    setStatus('Ready to execute permit and transfer operation.')
                    break
                default:
                    setStatus('')
            }
            return nextStep
        })
        setStepCompleted(false)
    }

    const getActionButtonText = (step: number) => {
        switch (step) {
            case 0:
                return 'Connect MetaMask'
            case 1:
                return 'Switch Network'
            case 2:
                return 'Sign Delegation'
            case 3:
                return 'Mint & Transfer Tokens'
            case 4:
                return 'Submit Operation'
            default:
                return 'Continue'
        }
    }

    const getStepContent = (step: number) => {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail, index) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5, fontSize: '0.875rem' }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>
                            {connectedAccount ? 
                                `Connected: ${connectedAccount}` : 
                                'Please connect your MetaMask wallet to continue.'}
                        </Typography>
                        {status.includes('Deploying') && (
                            <Box sx={{ 
                                mb: 2, 
                                p: 2, 
                                bgcolor: '#fff9c4', 
                                borderRadius: 1,
                                border: '1px solid #ffd54f'
                            }}>
                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box component="span" sx={{ fontSize: '1.1rem' }}>⚙️</Box>
                                    Deploying your smart account... This is a one-time setup that enables EIP-7702 delegations.
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.875rem' }}>
                                    This may take a few moments.
                                </Typography>
                            </Box>
                        )}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || stepCompleted}
                            >
                                {isLoading ? <CircularProgress size={24} /> : getActionButtonText(step)}
                            </Button>
                            {stepCompleted && (
                                <Button
                                    variant="outlined"
                                    onClick={handleNext}
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
                            {STEPS[step].details.map((detail, index) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5, fontSize: '0.875rem' }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Select Network</InputLabel>
                            <Select
                                value={selectedNetwork}
                                onChange={(e) => setSelectedNetwork(e.target.value)}
                                label="Select Network"
                            >
                                <MenuItem value="0xaa36a7">Sepolia (Chain ID: 11155111)</MenuItem>
                                <MenuItem value="0x1" disabled>Ethereum Mainnet (Chain ID: 1) - Not Available</MenuItem>
                            </Select>
                        </FormControl>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button onClick={handleBack}>Back</Button>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || stepCompleted}
                            >
                                {isLoading ? <CircularProgress size={24} /> : getActionButtonText(step)}
                            </Button>
                            {stepCompleted && (
                                <Button
                                    variant="outlined"
                                    onClick={handleNext}
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
                            {STEPS[step].details.map((detail, index) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5, fontSize: '0.875rem' }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>
                            {delegatorSmartAccount ? 
                                `Smart Account: ${delegatorSmartAccount.address}` : 
                                'Preparing smart account...'}
                        </Typography>
                        {delegateSmartAccount && (
                            <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>
                                Delegate Account: {delegateSmartAccount.address}
                            </Typography>
                        )}
                        {signedDelegation && (
                            <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>
                                Signature: {signedDelegation.signature.slice(0, 66)}...
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button onClick={handleBack}>Back</Button>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || stepCompleted || !delegatorSmartAccount}
                            >
                                {isLoading ? <CircularProgress size={24} /> : getActionButtonText(step)}
                            </Button>
                            {stepCompleted && (
                                <Button
                                    variant="outlined"
                                    onClick={handleNext}
                                    color="success"
                                >
                                    Next
                                </Button>
                            )}
                        </Box>
                    </Box>
                )
            case 3:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail, index) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5, fontSize: '0.875rem' }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>
                            {status}
                        </Typography>
                        {mintUserOpHash && (
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
                                    >
                                        Operation Details
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
                                        >
                                            User Operation Hash: {mintUserOpHash}
                                        </Typography>
            
                                    </Box>
                                    {mintTxHash && (
                                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'medium', mb: 1 }}>
                                                Mint & Transfer Operation Confirmed ✓
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
                                            >
                                                Transaction Hash: {mintTxHash}
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                size="small"
                                                component="a"
                                                href={`https://sepolia.etherscan.io/tx/${mintTxHash}`}
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
                            <Button onClick={handleBack}>Back</Button>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || stepCompleted || !signedDelegation}
                            >
                                {isLoading ? <CircularProgress size={24} /> : getActionButtonText(step)}
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={handleNext}
                                sx={{ minWidth: 100 }}
                            >
                                Skip
                            </Button>
                            {stepCompleted && (
                                <Button
                                    variant="outlined"
                                    onClick={handleNext}
                                    color="success"
                                >
                                    Next
                                </Button>
                            )}
                        </Box>
                    </Box>
                )
            case 4:
                return (
                    <Box>
                        <Box sx={{ mb: 2 }}>
                            {STEPS[step].details.map((detail, index) => (
                                <Typography 
                                    key={index} 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ mb: 0.5, fontSize: '0.875rem' }}
                                >
                                    • {detail}
                                </Typography>
                            ))}
                        </Box>
                        <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>
                            {status}
                        </Typography>
                        {executeUserOpHash && (
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
                                    >
                                        Operation Details
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
                                        >
                                            User Operation Hash: {executeUserOpHash}
                                        </Typography>
  
                                    </Box>
                                    {executeTxHash && (
                                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'medium', mb: 1 }}>
                                                Permit & Transfer Operation Confirmed ✓
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
                                            >
                                                Transaction Hash: {executeTxHash}
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                size="small"
                                                component="a"
                                                href={`https://sepolia.etherscan.io/tx/${executeTxHash}`}
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
                            <Button onClick={handleBack}>Back</Button>
                            <Button
                                variant="contained"
                                onClick={handleAction}
                                disabled={isLoading || stepCompleted || !signedDelegation}
                            >
                                {isLoading ? <CircularProgress size={24} /> : getActionButtonText(step)}
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
            overflow: 'hidden'
        }}>
            <Box sx={{ 
                maxWidth: 800,
                mx: 'auto',
                p: 3,
                paddingBottom: '120px'
            }}>
                <Typography variant="h4" gutterBottom>
                    EIP-7702 and ERC-4337 Delegation Demo
                </Typography>

                <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        This demo showcases how to use{' '}
                        <Link href="https://eips.ethereum.org/EIPS/eip-7702" target="_blank" rel="noopener">
                            EIP-7702
                        </Link>{' '}
                        delegations with{' '}
                        <Link href="https://eips.ethereum.org/EIPS/eip-4337" target="_blank" rel="noopener">
                            ERC-4337
                        </Link>{' '}
                        account abstraction, using{' '}
                        <Link href="https://pimlico.io" target="_blank" rel="noopener">
                            Pimlico
                        </Link>{' '}
                        as the bundler and paymaster. Create a smart account, delegate transaction execution, and mint & transfer tokens in a single user operation, using a sponsored (gasless) user operation.
                    </Typography>
                </Paper>

                {connectedAccount && balances && (
                    <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Connected Account
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
                                mb: 2
                            }}
                        >
                            {connectedAccount}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    ETH Balance
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                    {balances.eth} ETH
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    TEST Balance
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                    {balances.test} TEST
                                </Typography>
                            </Box>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Network
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'success.main' }}>
                                Sepolia Testnet (Chain ID: 11155111)
                            </Typography>
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
                    mt: 4
                }}
            >
                <Box 
                    sx={{ 
                        maxWidth: 800,
                        width: '100%',
                        mx: 'auto',
                        px: 3, // Horizontal padding to match main content
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
                            flexWrap: 'wrap' // Allow wrapping for smaller screens
                        }}>
                            <Link 
                                href="https://eips.ethereum.org/EIPS/eip-7702" 
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
                                EIP-7702
                            </Link>
                            <Link 
                                href="https://eips.ethereum.org/EIPS/eip-4337" 
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
                                ERC-4337
                            </Link>
                            <Link 
                                href="https://pimlico.io" 
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
                                Pimlico
                            </Link>
                            <Link 
                                href="https://metamask.io" 
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
                                MetaMask
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