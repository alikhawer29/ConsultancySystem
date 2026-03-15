// Simple test script to verify device functionality
// This can be run with: node test_device_functionality.js

const mongoose = require('mongoose');
const User = require('./src/models/user.model');

// Test data
const testUser = {
    first_name: 'Test',
    last_name: 'User',
    email: 'testuser@example.com',
    password: 'password123',
    phone: '1234567890',
    country_code: 'US',
    dialing_code: '+1',
    device_ids: ['test_device_token_1'],
    device_type: 'android'
};

async function testDeviceFunctionality() {
    try {
        // Connect to database (adjust connection string as needed)
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lynx');
        console.log('Connected to database');

        // Test 1: Create user with device information
        console.log('\n=== Test 1: Creating user with device info ===');
        const user = new User(testUser);
        await user.save();
        console.log('✅ User created successfully');
        console.log('Device IDs:', user.device_ids);
        console.log('Device Type:', user.device_type);

        // Test 2: Add another device ID
        console.log('\n=== Test 2: Adding another device ID ===');
        user.device_ids.push('test_device_token_2');
        await user.save();
        console.log('✅ Second device ID added');
        console.log('Device IDs:', user.device_ids);

        // Test 3: Update device type
        console.log('\n=== Test 3: Updating device type ===');
        user.device_type = 'ios';
        await user.save();
        console.log('✅ Device type updated');
        console.log('Device Type:', user.device_type);

        // Test 4: Try to add duplicate device ID
        console.log('\n=== Test 4: Testing duplicate prevention ===');
        const originalLength = user.device_ids.length;
        user.device_ids.push('test_device_token_1'); // Duplicate
        await user.save();
        const newLength = user.device_ids.length;
        if (originalLength === newLength) {
            console.log('✅ Duplicate prevention working correctly');
        } else {
            console.log('❌ Duplicate prevention failed');
        }

        // Cleanup
        await User.deleteOne({ email: testUser.email });
        console.log('\n✅ Test completed successfully!');
        console.log('✅ Test user cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests
if (require.main === module) {
    testDeviceFunctionality();
}

module.exports = testDeviceFunctionality;
