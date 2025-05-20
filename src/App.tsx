import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { CssBaseline, ThemeProvider, createTheme, AppBar, Toolbar, Button, Box, IconButton } from '@mui/material'
import GitHubIcon from '@mui/icons-material/GitHub'
import { Demo as Demo3 } from './demo-7702-4337-delegation/Demo'
import { Demo as Demo2 } from './demo-7702-4337/Demo'
import { Demo as Demo1 } from './demo-7702/Demo'
import { Demo as Demo4 } from './demo-7710-7715/Demo'

const theme = createTheme({
    palette: {
        mode: 'light',
    },
})

export function App() {
    return (
        <Router>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <AppBar position="static">
                    <Toolbar>
                        <Button color="inherit" component={Link} to="/eip-7702-demo">
                            EIP-7702 Demo
                        </Button>
                        <Button color="inherit" component={Link} to="/eip-7702-erc-4337-demo">
                            EIP-7702/ERC-4337 Demo
                        </Button>
                        <Button color="inherit" component={Link} to="/eip-7702-erc-4337-delegation-demo">
                            EIP-7702/ERC-4337 Delegation Demo
                        </Button>
                        <Button color="inherit" component={Link} to="/erc-7710-erc-7715-demo">
                            ERC-7710/ERC-7715 Demo
                        </Button>
                        <Box sx={{ flexGrow: 1 }} />
                        <IconButton
                            color="inherit"
                            component="a"
                            href="https://github.com/miguelmota/account-abstraction-demos"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <GitHubIcon />
                        </IconButton>
                    </Toolbar>
                </AppBar>
                <Box sx={{ mt: 2 }}>
                    <Routes>
                        <Route path="/" element={<Demo1 />} />
                        <Route path="/eip-7702-demo" element={<Demo1 />} />
                        <Route path="/eip-7702-erc-4337-demo" element={<Demo2 />} />
                        <Route path="/eip-7702-erc-4337-delegation-demo" element={<Demo3 />} />
                        <Route path="/erc-7710-erc-7715-demo" element={<Demo4 />} />
                    </Routes>
                </Box>
            </ThemeProvider>
        </Router>
    )
} 