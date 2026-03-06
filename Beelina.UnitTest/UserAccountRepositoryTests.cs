using Xunit;
using Moq;
using Beelina.LIB.BusinessLogic;
using Beelina.LIB.Interfaces;
using Beelina.LIB.Models;
using Beelina.LIB.Enums;
using Beelina.LIB.DbContexts;
using Microsoft.EntityFrameworkCore;

namespace Beelina.UnitTest;

public class UserAccountRepositoryTests
    : BeelinaBaseTest
{
    public UserAccountRepositoryTests()
    : base()
    {
    }

    private UserAccountRepository CreateRepository()
    {
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);

        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        beelinaRepoMock.SetupGet(x => x.SystemDbContext).Returns((Beelina.LIB.DbContexts.BeelinaDataContext)null);

        return new UserAccountRepository(beelinaRepoMock.Object);
    }

    [Fact]
    public async Task GetUserAccounts_Returns_All_Active_Users()
    {
        // Arrange
        var repo = CreateRepository();

        // Act
        var result = await repo.GetUserAccounts();

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result);
        Assert.Equal(3, result.Count); // AdminAccount, FieldAgent, WarehouseAgent
        Assert.All(result, user => Assert.False(user.IsDelete));
    }

    [Fact]
    public async Task GetUserAccounts_With_UserId_Filter_Returns_Single_User()
    {
        // Arrange
        var repo = CreateRepository();

        // Act
        var result = await repo.GetUserAccounts(FieldAgent.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal(FieldAgent.Id, result.First().Id);
        Assert.Equal("Field", result.First().FirstName);
    }

    [Fact]
    public async Task GetUserAccounts_With_Keyword_Filter_Returns_Matching_Users()
    {
        // Arrange
        var repo = CreateRepository();

        // Act
        var result = await repo.GetUserAccounts(0, "Field");

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Contains("Field", result.First().FirstName);
    }

    [Fact]
    public async Task Register_Creates_User_With_Hashed_Password()
    {
        // Arrange
        var repo = CreateRepository();
        var newAccount = new UserAccount
        {
            Username = "testuser",
            FirstName = "Test",
            LastName = "User",
            IsActive = true,
            IsDelete = false
        };
        var password = "TestPassword123!";

        // Act
        var result = await repo.Register(newAccount, password);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.PasswordHash);
        Assert.NotNull(result.PasswordSalt);
        Assert.True(result.PasswordHash.Length > 0);
        Assert.True(result.PasswordSalt.Length > 0);
    }

    [Fact]
    public async Task UserExists_Returns_True_When_Username_Already_Taken()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);

        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        var repo = new UserAccountRepository(beelinaRepoMock.Object);
        
        // First register a user with a known username
        var existingAccount = new UserAccount
        {
            Username = "existinguser",
            FirstName = "Existing",
            LastName = "User",
            IsActive = true,
            IsDelete = false
        };
        
        await repo.Register(existingAccount, "Password123!");
        context.UserAccounts.Add(existingAccount); // Manually add since _beelinaRepository mock doesn't add
        await context.SaveChangesAsync();

        // Act
        var result = await repo.UserExists("existinguser");

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task UserExists_Returns_False_For_Own_Username()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);
        
        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        var repo = new UserAccountRepository(beelinaRepoMock.Object);
        
        // Register a user
        var account = new UserAccount
        {
            Username = "myusername",
            FirstName = "My",
            LastName = "User",
            IsActive = true,
            IsDelete = false
        };
        await repo.Register(account, "Password123!");
        await context.SaveChangesAsync();

        // Act - pass the same user's ID
        var result = await repo.UserExists("myusername", account.Id);

        // Assert - should return false because it's the same user
        Assert.False(result);
    }

    [Fact]
    public async Task Login_Returns_Account_With_Valid_Credentials()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);
        
        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        var repo = new UserAccountRepository(beelinaRepoMock.Object);
        
        var password = "ValidPassword123!";
        
        var newAccount = new UserAccount
        {
            Username = "logintest",
            FirstName = "Login",
            LastName = "Test",
            IsActive = true,
            IsDelete = false
        };
        await repo.Register(newAccount, password);
        context.UserAccounts.Add(newAccount); // Manually add since _beelinaRepository mock doesn't add
        await context.SaveChangesAsync();

        // Act
        var result = await repo.Login("logintest", password);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("logintest", result.Username);
    }

    [Fact]
    public async Task Login_Returns_Null_With_Invalid_Password()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);
        
        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        var repo = new UserAccountRepository(beelinaRepoMock.Object);
        
        var correctPassword = "CorrectPassword123!";
        
        var newAccount = new UserAccount
        {
            Username = "passwordtest",
            FirstName = "Password",
            LastName = "Test",
            IsActive = true,
            IsDelete = false
        };
        await repo.Register(newAccount, correctPassword);
        context.UserAccounts.Add(newAccount); // Manually add since _beelinaRepository mock doesn't add
        await context.SaveChangesAsync();

        // Act
        var result = await repo.Login("passwordtest", "WrongPassword");

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task Login_Returns_Null_For_Inactive_User()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);
        
        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        var repo = new UserAccountRepository(beelinaRepoMock.Object);
        
        var password = "Password123!";
        
        var newAccount = new UserAccount
        {
            Username = "inactivetest",
            FirstName = "Inactive",
            LastName = "Test",
            IsActive = false, // Inactive user
            IsDelete = false
        };
        await repo.Register(newAccount, password);
        context.UserAccounts.Add(newAccount); // Manually add since _beelinaRepository mock doesn't add
        await context.SaveChangesAsync();

        // Act
        var result = await repo.Login("inactivetest", password);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task Login_ByPass_Returns_Account_Without_Password()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);
        
        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        var repo = new UserAccountRepository(beelinaRepoMock.Object);
        
        var password = "Password123!";
        
        var newAccount = new UserAccount
        {
            Username = "bypasstest",
            FirstName = "Bypass",
            LastName = "Test",
            IsActive = true,
            IsDelete = false
        };
        await repo.Register(newAccount, password);
        context.UserAccounts.Add(newAccount); // Manually add since _beelinaRepository mock doesn't add
        await context.SaveChangesAsync();

        // Act - bypass authentication
        var result = await repo.Login("bypasstest", "WrongPassword", byPassAuthentication: true);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("bypasstest", result.Username);
    }

    [Fact]
    public async Task GetAllSalesAgents_Returns_Only_Users_With_User_PermissionLevel()
    {
        // Arrange
        var repo = CreateRepository();

        // Act
        var result = await repo.GetAllSalesAgents();

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result);
        // FieldAgent and WarehouseAgent both have PermissionLevel.User and ModuleId.Distribution
        Assert.Equal(2, result.Count);
        Assert.All(result, user => 
        {
            Assert.Contains(user.UserPermissions, p => 
                p.PermissionLevel == PermissionLevelEnum.User && 
                p.ModuleId == ModulesEnum.Distribution);
        });
        // AdminAccount should NOT be in the list
        Assert.DoesNotContain(result, u => u.Id == AdminAccount.Id);
    }

    [Fact]
    public async Task GenerateNewPassword_Returns_NonEmpty_Hash_And_Salt()
    {
        // Arrange
        var repo = CreateRepository();
        var password = "TestPassword123!";

        // Act
        var result = repo.GenerateNewPassword(password);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.PasswordHash);
        Assert.NotNull(result.PasswordSalt);
        Assert.True(result.PasswordHash.Length > 0);
        Assert.True(result.PasswordSalt.Length > 0);
    }

    [Fact]
    public async Task GenerateNewRefreshToken_Returns_Token_With_Future_Expiry()
    {
        // Arrange
        var repo = CreateRepository();

        // Act
        var result = repo.GenerateNewRefreshToken();

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Token);
        Assert.NotEmpty(result.Token);
        Assert.True(result.ExpirationDate > DateTime.Now);
        // Should expire in approximately 5 days
        var expectedExpiry = DateTime.Now.AddDays(5);
        Assert.True(result.ExpirationDate > DateTime.Now.AddDays(4));
        Assert.True(result.ExpirationDate < DateTime.Now.AddDays(6));
    }

    [Fact]
    public async Task GetCurrentUsersPermissionLevel_Returns_Correct_Permission()
    {
        // Arrange
        var repo = CreateRepository();

        // Act
        var result = await repo.GetCurrentUsersPermissionLevel(FieldAgent.Id, ModulesEnum.Distribution);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(PermissionLevelEnum.User, result.PermissionLevel);
        Assert.Equal(ModulesEnum.Distribution, result.ModuleId);
        Assert.Equal(FieldAgent.Id, result.UserAccountId);
    }

    [Fact]
    public async Task DeleteMultipleUserAccounts_Soft_Deletes_Users()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);
        
        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        beelinaRepoMock.Setup(x => x.DeleteMultipleEntities(It.IsAny<List<UserAccount>>(), It.IsAny<bool>()))
            .Callback<List<UserAccount>, bool>((entities, forceDelete) =>
            {
                if (!forceDelete)
                    foreach (var e in entities) e.IsDelete = true;
            });
        beelinaRepoMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns<CancellationToken>(async ct => { await context.SaveChangesAsync(ct); return true; });
        var repo = new UserAccountRepository(beelinaRepoMock.Object);
        
        var userIds = new List<int> { FieldAgent.Id, WarehouseAgent.Id };

        // Act
        var result = await repo.DeleteMultipleUserAccounts(userIds);

        // Assert
        Assert.True(result);
        
        // Verify users are marked as deleted
        var deletedUsers = await repo.GetUserAccounts();
        // Only AdminAccount should remain (not deleted)
        Assert.Single(deletedUsers);
        Assert.Equal(AdminAccount.Id, deletedUsers.First().Id);
    }

    [Fact]
    public async Task SetMultipleUserAccountsStatus_Activates_And_Deactivates()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<BeelinaClientDataContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new BeelinaClientDataContext(options, new Mock<IDataContextHelper>().Object);

        SeedSampleData(context, 1);
        
        var beelinaRepoMock = new Mock<IBeelinaRepository<UserAccount>>();
        beelinaRepoMock.SetupGet(x => x.ClientDbContext).Returns(context);
        beelinaRepoMock.Setup(x => x.SetMultipleEntitiesStatus(It.IsAny<List<UserAccount>>(), It.IsAny<bool>()))
            .Callback<List<UserAccount>, bool>((entities, status) =>
            {
                foreach (var e in entities) e.IsActive = status;
            });
        beelinaRepoMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns<CancellationToken>(async ct => { await context.SaveChangesAsync(ct); return true; });
        var repo = new UserAccountRepository(beelinaRepoMock.Object);
        
        var userIds = new List<int> { FieldAgent.Id, WarehouseAgent.Id };

        // Act - Deactivate
        var deactivateResult = await repo.SetMultipleUserAccountsStatus(userIds, false);

        // Assert - Deactivate
        Assert.True(deactivateResult);
        var usersAfterDeactivate = await repo.GetUserAccounts();
        var deactivatedField = usersAfterDeactivate.FirstOrDefault(u => u.Id == FieldAgent.Id);
        var deactivatedWarehouse = usersAfterDeactivate.FirstOrDefault(u => u.Id == WarehouseAgent.Id);
        Assert.NotNull(deactivatedField);
        Assert.NotNull(deactivatedWarehouse);
        Assert.False(deactivatedField.IsActive);
        Assert.False(deactivatedWarehouse.IsActive);

        // Act - Reactivate
        var activateResult = await repo.SetMultipleUserAccountsStatus(userIds, true);

        // Assert - Reactivate
        Assert.True(activateResult);
        var usersAfterActivate = await repo.GetUserAccounts();
        var activatedField = usersAfterActivate.FirstOrDefault(u => u.Id == FieldAgent.Id);
        var activatedWarehouse = usersAfterActivate.FirstOrDefault(u => u.Id == WarehouseAgent.Id);
        Assert.NotNull(activatedField);
        Assert.NotNull(activatedWarehouse);
        Assert.True(activatedField.IsActive);
        Assert.True(activatedWarehouse.IsActive);
    }
}
