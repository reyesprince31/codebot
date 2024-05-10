/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
    if (context.payload.sender.type === "Bot") {
      app.log.info("Issue opened by a bot, skipping comment creation");
      return;
    }
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    return context.octokit.issues.createComment(issueComment);
  });

  app.on("pull_request.opened", async (context) => {
    const pull_request_title = context.payload.pull_request.title;
    const pull_request_comment = context.payload.pull_request.body;
    console.log(pull_request_title, pull_request_comment);

    // Fetch the commits from the pull request
    const commits = await context.octokit.pulls.listCommits({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      pull_number: context.payload.pull_request.number,
    });

    console.log(commits);
    context.commits = commits.data;
    context.pull_request_title = pull_request_title;
    context.pull_request_comment = pull_request_comment;

    const prComment = {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.payload.pull_request.number,
      body: `Thanks for opening this pull request! this copy of ${pull_request_title}\n will be copied on local branch`,
    };

    return context.octokit.issues.createComment(prComment);
  });

  app.on("pull_request.closed", async (context) => {
    const { action, pull_request, repository } = context.payload;

    console.log(
      `Pull request #${pull_request.number} in ${repository.full_name} was ${action}`
    );

    if (action === "closed" && pull_request.merged) {
      console.log("Pull request was merged");

      const pull_request_title = pull_request.title;
      const pull_request_comment = pull_request.body;

      // Check if the merged pull request was from the 'develop' branch to the 'main' branch
      if (pull_request.base.ref === "main" && pull_request.head.ref === "dev") {
        console.log("Merged pull request is from 'develop' to 'main' branch");

        // Open a pull request in another repository with a different owner
        const anotherRepoOwner = "reyesprince"; // Replace with the desired owner's username
        const anotherRepoName = "my_first_repo"; // Replace with the desired repository name
        const branchName = "merge-from-source-repo"; // Replace with the desired branch name

        // Send a notification to the designated user or team
        const issueBody = `A new pull request has been merged in ${repository.full_name} from the \`develop\` branch to the \`main\` branch (PR #${pull_request.number}).
        Please create a new branch named \`${branchName}\` in the ${anotherRepoOwner}/${anotherRepoName} repository and make the following commit:

        \`\`\`
        git checkout -b ${branchName}
        echo "Merge changes from ${repository.full_name}#${pull_request.number}" >> README.md
        git add README.md
        git commit -m "Merge changes from ${repository.full_name}#${pull_request.number}"
        git push origin ${branchName}
        \`\`\`

        Once the branch is created and the commit is pushed, a new pull request will be opened automatically.
        `;

        const newIssue = await context.octokit.issues.create({
          owner: anotherRepoOwner,
          repo: anotherRepoName,
          title: `Merge changes from ${repository.full_name}#${pull_request.number}`,
          body: issueBody,
        });

        console.log(
          `Opened new issue #${newIssue.data.number} in ${anotherRepoOwner}/${anotherRepoName} with instructions`
        );
      } else {
        console.log(
          "Merged pull request is not from 'develop' to 'main' branch, skipping"
        );
      }
    } else if (action === "closed" && !pull_request.merged) {
      console.log("Pull request was closed without merging");
    }
  });

  app.on("pull_request.synchronize", async (context) => {
    const prComment = {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.payload.pull_request.number,
      body: `Thanks for this ${context.payload.pull_request.title}, I will update the local branch`,
    };

    return context.octokit.issues.createComment(prComment);
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
